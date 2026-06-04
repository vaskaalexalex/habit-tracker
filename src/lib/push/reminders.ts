import { env } from '$env/dynamic/public';
import { base } from '$app/paths';
import { DEFAULT_VAPID_PUBLIC_KEY } from '$lib/push/default-vapid-public';
import { ensurePushServiceWorkerRegistration } from '$lib/push/service-worker';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '$supabase/client';
import type { Database } from '$supabase/types';

type PushInsert = Database['public']['Tables']['push_subscriptions']['Insert'];

const VAPID_MISMATCH_HINT =
	' Проверь, что PUBLIC_VAPID_PUBLIC_KEY в сборке совпадает с приватным ключом на Edge/Vault.';

export type EnsureSubscriptionResult = { ok: true } | { ok: false; error: string };

type EdgePushResponse = {
	ok?: boolean;
	code?: string;
	error?: string;
	reminders_sent?: number;
	errors?: string[];
};

export function getDeviceTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
}

export function habitPushJournalRelUrl(appBasePath: string = base): string {
	const b = appBasePath.replace(/\/$/, '');
	return b ? `${b}/journal` : '/journal';
}

function getVapidPublicKey(): string {
	return (env.PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY).trim();
}

/** Keep server-side TZ + base path aligned with device (call on session refresh). */
export async function syncUserReminderTimezone(userId: string): Promise<void> {
	if (!isSupabaseConfigured) return;
	const tz = getDeviceTimeZone();
	const { error } = await supabase.from('user_push_reminders').upsert(
		{
			user_id: userId,
			user_timezone: tz,
			app_base_path: base,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'user_id' }
	);
	if (error) console.warn('[push] sync timezone', error.message);
}

export async function fetchReminderSettings(userId: string): Promise<boolean> {
	if (!isSupabaseConfigured) return false;
	const { data, error } = await supabase
		.from('user_push_reminders')
		.select('reminders_enabled')
		.eq('user_id', userId)
		.maybeSingle();
	if (error) {
		console.warn('[push] fetch settings', error.message);
		return false;
	}
	return data?.reminders_enabled ?? false;
}

/** PWA / Safari: subscription can lag briefly after subscribe() — retry before treating as missing. */
async function getPushSubscriptionWithRetry(
	registration: ServiceWorkerRegistration,
	attempts = 8,
	delayMs = 120
): Promise<PushSubscription | null> {
	for (let i = 0; i < attempts; i++) {
		try {
			const sub = await registration.pushManager.getSubscription();
			if (sub) return sub;
		} catch {
			return null;
		}
		if (i < attempts - 1) {
			await new Promise((r) => setTimeout(r, delayMs));
		}
	}
	return null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const b64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(b64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

/**
 * After a VAPID key rotation an existing subscription still carries the OLD
 * `applicationServerKey`, so the server's push (signed with the new private key)
 * is rejected by the push service (Apple: VapidPkHashMismatch). Detect the drift
 * so the caller can re-subscribe with the current key instead of reusing a dead sub.
 */
function subscriptionMatchesVapidKey(subscription: PushSubscription, vapidKey: string): boolean {
	const current = subscription.options?.applicationServerKey;
	if (!current) return true; // key not exposed → can't compare, assume current
	const a = new Uint8Array(current as ArrayBuffer);
	const b = urlBase64ToUint8Array(vapidKey);
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

async function subscribeWithVapid(
	registration: ServiceWorkerRegistration,
	vapidKey: string
): Promise<PushSubscription> {
	const appKey = urlBase64ToUint8Array(vapidKey);
	return registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: appKey as BufferSource
	});
}

async function upsertSubscriptionToDb(
	userId: string,
	subscription: PushSubscription
): Promise<{ error?: string }> {
	const j = subscription.toJSON();
	const endpoint = j.endpoint;
	const key = j.keys;
	if (!endpoint || !key?.p256dh || !key?.auth) {
		return { error: 'Некорректная подписка push' };
	}

	const row: PushInsert = {
		user_id: userId,
		endpoint,
		p256dh: key.p256dh,
		auth: key.auth
	};

	const { error: subErr } = await supabase.from('push_subscriptions').upsert(row, {
		onConflict: 'user_id,endpoint'
	});
	if (subErr) return { error: `Подписка в БД: ${subErr.message}` };

	const { error: delErr } = await supabase
		.from('push_subscriptions')
		.delete()
		.eq('user_id', userId)
		.neq('endpoint', endpoint);
	if (delErr) console.warn('[push] prune stale subscriptions', delErr.message);

	return {};
}

/**
 * Ensure the browser's current PushSubscription is stored in Supabase and stale rows are removed.
 * Safe to call on boot and before server push tests.
 */
export async function ensureCurrentDeviceSubscriptionStored(
	userId: string
): Promise<EnsureSubscriptionResult> {
	if (!isSupabaseConfigured) return { ok: false, error: 'Supabase не настроен' };
	if (typeof window === 'undefined') return { ok: false, error: 'Только в браузере' };
	if (!('Notification' in window)) return { ok: false, error: 'Уведомления недоступны' };
	if (Notification.permission !== 'granted') {
		return { ok: false, error: 'Нет разрешения на уведомления' };
	}
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
		return { ok: false, error: 'Push не поддерживается' };
	}

	const dbOn = await fetchReminderSettings(userId);
	if (!dbOn) return { ok: false, error: 'Напоминания выключены' };

	const vapidKey = getVapidPublicKey();
	if (!vapidKey) {
		return {
			ok: false,
			error:
				'Не задан публичный VAPID-ключ: добавь PUBLIC_VAPID_PUBLIC_KEY в GitHub Actions / Cloudflare или обнови default-vapid-public.ts при ротации ключей.'
		};
	}

	const registration = await ensurePushServiceWorkerRegistration();
	if (!registration) return { ok: false, error: 'Не удалось зарегистрировать service worker' };

	let subscription = await getPushSubscriptionWithRetry(registration);
	if (subscription && !subscriptionMatchesVapidKey(subscription, vapidKey)) {
		// Stale subscription from a previous VAPID key — drop it and re-subscribe below.
		try {
			await subscription.unsubscribe();
		} catch {
			/* ignore */
		}
		subscription = null;
	}
	if (!subscription) {
		try {
			subscription = await subscribeWithVapid(registration, vapidKey);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Не удалось подписаться на push';
			try {
				const old = await registration.pushManager.getSubscription();
				await old?.unsubscribe();
				subscription = await subscribeWithVapid(registration, vapidKey);
			} catch (e2) {
				const msg2 = e2 instanceof Error ? e2.message : msg;
				const hint = /vapid|key|401|403/i.test(msg2) ? VAPID_MISMATCH_HINT : '';
				return { ok: false, error: msg2 + hint };
			}
		}
	}

	const upsertResult = await upsertSubscriptionToDb(userId, subscription);
	if (upsertResult.error) return { ok: false, error: upsertResult.error };

	await syncUserReminderTimezone(userId);
	return { ok: true };
}

/**
 * Whether the reminders toggle should show "on": DB flag plus a live browser push subscription stored server-side.
 */
export async function getRemindersEnabledConsolidated(userId: string): Promise<boolean> {
	const dbOn = await fetchReminderSettings(userId);
	if (!dbOn) return false;
	if (typeof window === 'undefined') return dbOn;
	const result = await ensureCurrentDeviceSubscriptionStored(userId);
	return result.ok;
}

/** After enabling in UI: confirm permission, active push subscription, and DB rows. */
export async function verifyPushReminderEnabled(userId: string): Promise<boolean> {
	const result = await ensureCurrentDeviceSubscriptionStored(userId);
	return result.ok;
}

export async function enableHabitReminders(userId: string): Promise<{ error?: string }> {
	if (!isSupabaseConfigured) return { error: 'Supabase не настроен' };
	const vapidKey = getVapidPublicKey();
	if (!vapidKey) {
		return {
			error:
				'Не задан публичный VAPID-ключ: добавь PUBLIC_VAPID_PUBLIC_KEY в GitHub Actions / Cloudflare или обнови default-vapid-public.ts при ротации ключей.'
		};
	}

	if (typeof window === 'undefined' || !('Notification' in window)) {
		return { error: 'Уведомления недоступны' };
	}
	const perm = await Notification.requestPermission();
	if (perm !== 'granted') return { error: 'Разрешение на уведомления не выдано' };

	if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
		return { error: 'Push не поддерживается' };
	}

	const registration = await ensurePushServiceWorkerRegistration();
	if (!registration) return { error: 'Не удалось зарегистрировать service worker' };

	let subscription: PushSubscription;
	try {
		subscription = await subscribeWithVapid(registration, vapidKey);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Не удалось подписаться на push';
		try {
			const old = await registration.pushManager.getSubscription();
			await old?.unsubscribe();
			subscription = await subscribeWithVapid(registration, vapidKey);
		} catch (e2) {
			const msg2 = e2 instanceof Error ? e2.message : msg;
			const hint = /vapid|key|401|403/i.test(msg2) ? VAPID_MISMATCH_HINT : '';
			return { error: msg2 + hint };
		}
	}

	const upsertResult = await upsertSubscriptionToDb(userId, subscription);
	if (upsertResult.error) return { error: upsertResult.error };

	const tz = getDeviceTimeZone();
	const { error: setErr } = await supabase.from('user_push_reminders').upsert(
		{
			user_id: userId,
			reminders_enabled: true,
			user_timezone: tz,
			app_base_path: base,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'user_id' }
	);
	if (setErr) return { error: `Настройки напоминаний: ${setErr.message}` };

	return {};
}

export async function disableHabitReminders(userId: string): Promise<{ error?: string }> {
	if (!isSupabaseConfigured) return { error: 'Supabase не настроен' };

	if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
		try {
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.getSubscription();
			await sub?.unsubscribe();
		} catch {
			/* ignore */
		}
	}

	const { error } = await supabase.from('user_push_reminders').upsert(
		{
			user_id: userId,
			reminders_enabled: false,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'user_id' }
	);
	if (error) return { error: error.message };

	await supabase.from('push_subscriptions').delete().eq('user_id', userId);

	return {};
}

/** Match JSON payload in `supabase/functions/send-habit-reminders/index.ts` and `showNotification` in `static/push-sw.js`. */
export const HABIT_PUSH_REMINDER_TITLE = 'Привычки';
export const HABIT_PUSH_REMINDER_BODY = 'Расскажи как прошел твой день.';

export type HabitPushPreviewUrls = { iconUrl: string; badgeUrl: string };

/**
 * Local preview: `registration.showNotification` (not server Web Push).
 */
export async function showHabitPushReminderPreview(
	urls: HabitPushPreviewUrls
): Promise<{ error?: string }> {
	if (typeof window === 'undefined') return { error: 'Только в браузере' };
	if (!('Notification' in window)) return { error: 'Уведомления недоступны' };
	if (Notification.permission !== 'granted') {
		return { error: 'Нет разрешения на уведомления' };
	}
	if (!('serviceWorker' in navigator)) return { error: 'Нет service worker' };
	try {
		const reg = await ensurePushServiceWorkerRegistration();
		if (!reg) return { error: 'Не удалось зарегистрировать service worker' };
		const options: NotificationOptions & { renotify?: boolean } = {
			body: HABIT_PUSH_REMINDER_BODY,
			icon: urls.iconUrl,
			badge: urls.badgeUrl,
			data: { url: habitPushJournalRelUrl() },
			tag: 'habit-reminder',
			renotify: true
		};
		await reg.showNotification(HABIT_PUSH_REMINDER_TITLE, options);
		return {};
	} catch (e) {
		return { error: e instanceof Error ? e.message : 'Не удалось показать уведомление' };
	}
}

export async function showHabitPushReminderPreviewAfterDelay(
	delayMs: number,
	urls: HabitPushPreviewUrls
): Promise<{ error?: string }> {
	if (typeof window === 'undefined') return { error: 'Только в браузере' };
	await new Promise<void>((resolve) => {
		window.setTimeout(resolve, delayMs);
	});
	return showHabitPushReminderPreview(urls);
}

async function edgeInvokeErrorMessage(error: unknown): Promise<string> {
	if (error instanceof FunctionsHttpError) {
		try {
			const body = (await error.context.json()) as { error?: string; message?: string; code?: string };
			if (body?.error) return body.error;
			if (body?.message) return body.message;
		} catch {
			/* ignore */
		}
		return `Ошибка Edge (${error.context.status})`;
	}
	if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
		return error.message;
	}
	if (error instanceof Error) return error.message;
	return 'Не удалось вызвать Edge Function';
}

async function invokeServerPushTest(
	userId: string,
	accessToken: string
): Promise<{ error?: string; code?: string }> {
	const { data, error } = await supabase.functions.invoke('send-habit-reminders', {
		body: { test_user_id: userId, skip_window: true, test: true },
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (error) return { error: await edgeInvokeErrorMessage(error) };

	const payload = data as EdgePushResponse | null;
	console.warn('[push] server test response', payload);

	if (!payload) return { error: 'Пустой ответ сервера' };
	if (!payload.ok) {
		return {
			error: payload.error ?? payload.errors?.[0] ?? 'Сервер не отправил push',
			code: payload.code
		};
	}
	if ((payload.reminders_sent ?? 0) < 1) {
		return {
			error: payload.error ?? payload.errors?.[0] ?? 'Push не отправлен',
			code: payload.code
		};
	}
	return {};
}

/** Invoke Edge to send a real Web Push (same path as 21:00 cron). Requires reminders on + DB subscription. */
export async function requestServerPushTest(userId: string): Promise<{ error?: string }> {
	if (!isSupabaseConfigured) return { error: 'Supabase не настроен' };

	const {
		data: { session },
		error: sessionErr
	} = await supabase.auth.getSession();
	if (sessionErr || !session?.access_token) {
		return { error: 'Нужен вход в аккаунт для серверного push' };
	}

	const heal = await ensureCurrentDeviceSubscriptionStored(userId);
	if (!heal.ok) return { error: heal.error };

	let result = await invokeServerPushTest(userId, session.access_token);
	if (result.code === 'subscription_gone') {
		const retryHeal = await ensureCurrentDeviceSubscriptionStored(userId);
		if (retryHeal.ok) {
			result = await invokeServerPushTest(userId, session.access_token);
		}
	}

	if (result.error) return { error: result.error };
	return {};
}
