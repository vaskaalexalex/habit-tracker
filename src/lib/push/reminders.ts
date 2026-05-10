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

/** After enabling in UI: confirm permission, active push subscription, and DB flag. */
export async function verifyPushReminderEnabled(userId: string): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	if (!('Notification' in window) || Notification.permission !== 'granted') return false;
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
	try {
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.getSubscription();
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
