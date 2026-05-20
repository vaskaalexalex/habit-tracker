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

async function hasPushSubscriptionInDb(userId: string): Promise<boolean> {
	const { count, error } = await supabase
		.from('push_subscriptions')
		.select('id', { count: 'exact', head: true })
		.eq('user_id', userId);
	if (error) {
		console.warn('[push] count subscriptions', error.message);
		return false;
	}
	return (count ?? 0) > 0;
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

/**
 * Whether the reminders toggle should show "on": DB flag plus in-browser permission and push subscription.
 */
export async function getRemindersEnabledConsolidated(userId: string): Promise<boolean> {
	const dbOn = await fetchReminderSettings(userId);
	if (!dbOn) return false;
	if (!(await hasPushSubscriptionInDb(userId))) return false;
	if (typeof window === 'undefined') return dbOn;
	if (!('Notification' in window) || Notification.permission !== 'granted') return false;
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
	try {
		const reg = await navigator.serviceWorker.ready;
		const sub = await getPushSubscriptionWithRetry(reg, 6, 100);
		return !!sub;
	} catch {
		return false;
	}
}

/** After enabling in UI: confirm permission, active push subscription, and DB rows. */
export async function verifyPushReminderEnabled(userId: string): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	if (!('Notification' in window) || Notification.permission !== 'granted') return false;
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
	if (!(await fetchReminderSettings(userId))) return false;
	if (!(await hasPushSubscriptionInDb(userId))) return false;
	try {
		const reg = await navigator.serviceWorker.ready;
		const sub = await getPushSubscriptionWithRetry(reg);
		if (!sub) return false;
	} catch {
		return false;
	}
	return true;
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

export async function enableHabitReminders(userId: string): Promise<{ error?: string }> {
	if (!isSupabaseConfigured) return { error: 'Supabase не настроен' };
	const vapidKey = (env.PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY).trim();
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

	const j = subscription.toJSON();
	const endpoint = j.endpoint;
	const key = j.keys;
	if (!endpoint || !key?.p256dh || !key?.auth) {
		return { error: 'Некорректная подписка push' };
	}

	const tz = getDeviceTimeZone();
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
			const body = (await error.context.json()) as { error?: string; message?: string };
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

	const { data, error } = await supabase.functions.invoke('send-habit-reminders', {
		body: { test_user_id: userId, skip_window: true, test: true },
		headers: { Authorization: `Bearer ${session.access_token}` }
	});
	if (error) return { error: await edgeInvokeErrorMessage(error) };
	const payload = data as { ok?: boolean; reminders_sent?: number; errors?: string[] } | null;
	if (!payload?.ok) {
		return { error: payload?.errors?.[0] ?? 'Сервер не отправил push' };
	}
	if ((payload.reminders_sent ?? 0) < 1) {
		return {
			error:
				'Push не отправлен: включи уведомления, дождись сохранения подписки, затем повтори тест.'
		};
	}
	return {};
}
