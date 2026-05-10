import { env } from '$env/dynamic/public';
import { DEFAULT_VAPID_PUBLIC_KEY } from '$lib/push/default-vapid-public';
import { supabase, isSupabaseConfigured } from '$supabase/client';
import type { Database } from '$supabase/types';

type PushInsert = Database['public']['Tables']['push_subscriptions']['Insert'];

export function getDeviceTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
}

/** Keep server-side TZ aligned with device (call on session refresh). */
export async function syncUserReminderTimezone(userId: string): Promise<void> {
	if (!isSupabaseConfigured) return;
	const tz = getDeviceTimeZone();
	const { error } = await supabase.from('user_push_reminders').upsert(
		{
			user_id: userId,
			user_timezone: tz,
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

/**
 * Whether the reminders toggle should show "on": DB flag plus in-browser permission and push subscription.
 * PWA can read `Notification.permission` and `PushManager.getSubscription()` (same origin as the app SW).
 */
export async function getRemindersEnabledConsolidated(userId: string): Promise<boolean> {
	const dbOn = await fetchReminderSettings(userId);
	if (!dbOn) return false;
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

/** After enabling in UI: confirm permission, active push subscription, and DB flag. */
export async function verifyPushReminderEnabled(userId: string): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	if (!('Notification' in window) || Notification.permission !== 'granted') return false;
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
	try {
		const reg = await navigator.serviceWorker.ready;
		const sub = await getPushSubscriptionWithRetry(reg);
		if (!sub) return false;
	} catch {
		return false;
	}
	return fetchReminderSettings(userId);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
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

	const registration = await navigator.serviceWorker.ready;
	let subscription: PushSubscription;
	try {
		const appKey = urlBase64ToUint8Array(vapidKey);
		subscription = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: appKey as BufferSource
		});
	} catch (e) {
		return { error: e instanceof Error ? e.message : 'Не удалось подписаться на push' };
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
	if (subErr) return { error: subErr.message };

	const { error: setErr } = await supabase.from('user_push_reminders').upsert(
		{
			user_id: userId,
			reminders_enabled: true,
			user_timezone: tz,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'user_id' }
	);
	if (setErr) return { error: setErr.message };

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
export const HABIT_PUSH_REMINDER_REL_URL = '/journal';

export type HabitPushPreviewUrls = { iconUrl: string; badgeUrl: string };

/**
 * Local preview: same title/body/tag/icon behavior as when the SW handles a real `push` event (no server round-trip).
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
		const reg = await navigator.serviceWorker.ready;
		const options: NotificationOptions & { renotify?: boolean } = {
			body: HABIT_PUSH_REMINDER_BODY,
			icon: urls.iconUrl,
			badge: urls.badgeUrl,
			data: { url: HABIT_PUSH_REMINDER_REL_URL },
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
