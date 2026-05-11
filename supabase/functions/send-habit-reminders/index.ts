/**
 * Scheduled Web Push: ~3h before local midnight (21:00 in user_timezone).
 * Sends only if the journal entry for that calendar day is not “meaningful”
 * (same idea as client `isJournalEntryMeaningful`: text or mood).
 * Invoke via Supabase cron or HTTP with Authorization: Bearer <CRON_SECRET> if set.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0';
import webpush from 'npm:web-push@3.6.7';

type ReminderRow = {
	user_id: string;
	reminders_enabled: boolean;
	user_timezone: string;
	last_reminder_for_user_date: string | null;
};

type SubRow = {
	id: string;
	user_id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
};

function zonedWallClock(
	iso: Date,
	timeZone: string
): { date: string; hour: number; minute: number } {
	try {
		const fmt = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
		const parts = fmt.formatToParts(iso);
		const map: Record<string, string> = {};
		for (const p of parts) {
			if (p.type !== 'literal') map[p.type] = p.value;
		}
		const y = map.year;
		const m = map.month;
		const d = map.day;
		const hour = Number(map.hour);
		const minute = Number(map.minute);
		if (!y || !m || !d || Number.isNaN(hour) || Number.isNaN(minute)) throw new Error('bad parts');
		return { date: `${y}-${m}-${d}`, hour, minute };
	} catch {
		return zonedWallClock(iso, 'UTC');
	}
}

/** Local minutes from midnight [0, 1440) */
function localMinutesFromMidnight(hour: number, minute: number): number {
	return hour * 60 + minute;
}

/** Target: 21:00 local = 1260 minutes; allow cron slack ±15 min */
function isInReminderWindow(hour: number, minute: number): boolean {
	const m = localMinutesFromMidnight(hour, minute);
	return m >= 21 * 60 - 15 && m <= 21 * 60 + 15;
}

/** True if we should nudge: no row, or empty content and no mood (aligned with client journal rules). */
async function journalNotFilledForDate(
	admin: ReturnType<typeof createClient>,
	userId: string,
	isoDate: string
): Promise<boolean> {
	const { data, error } = await admin
		.from('journal_entries')
		.select('content, mood')
		.eq('user_id', userId)
		.eq('date', isoDate)
		.maybeSingle();
	if (error) throw error;
	if (!data) return true;
	const content = typeof data.content === 'string' ? data.content.trim() : '';
	const meaningful = content.length > 0 || data.mood != null;
	return !meaningful;
}

Deno.serve(async (req) => {
	const authHeader = req.headers.get('authorization') ?? '';
	const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

	const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
	const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
	const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:habit-tracker@localhost';

	const admin = createClient(supabaseUrl, serviceKey);

	const { data: cfgRaw, error: cfgErr } = await admin.rpc('get_edge_push_config');
	const cfg =
		!cfgErr && cfgRaw && typeof cfgRaw === 'object'
			? (cfgRaw as { vapid_public?: string | null; vapid_private?: string | null; cron_secret?: string | null })
			: null;

	const cronSecret =
		(Deno.env.get('CRON_SECRET') ?? '').trim() || (cfg?.cron_secret ?? '').trim();
	if (cronSecret && bearer !== cronSecret) {
		return new Response(JSON.stringify({ error: 'unauthorized' }), {
			status: 401,
			headers: { 'content-type': 'application/json' }
		});
	}

	let vapidPublic = (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim();
	let vapidPrivate = (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').trim();
	if (!vapidPublic || !vapidPrivate) {
		vapidPublic = (cfg?.vapid_public ?? '').trim();
		vapidPrivate = (cfg?.vapid_private ?? '').trim();
	}
	if (!vapidPublic || !vapidPrivate) {
		return new Response(JSON.stringify({ error: 'missing_vapid_keys' }), {
			status: 500,
			headers: { 'content-type': 'application/json' }
		});
	}

	webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

	const { data: reminders, error: rErr } = await admin
		.from('user_push_reminders')
		.select('user_id, reminders_enabled, user_timezone, last_reminder_for_user_date')
		.eq('reminders_enabled', true);
	if (rErr) {
		return new Response(JSON.stringify({ error: rErr.message }), {
			status: 500,
			headers: { 'content-type': 'application/json' }
		});
	}

	const { data: subs, error: sErr } = await admin
		.from('push_subscriptions')
		.select('id,user_id,endpoint,p256dh,auth');
	if (sErr) {
		return new Response(JSON.stringify({ error: sErr.message }), {
			status: 500,
			headers: { 'content-type': 'application/json' }
		});
	}

	const reminderMap = new Map<string, ReminderRow>();
	for (const row of (reminders ?? []) as ReminderRow[]) {
		reminderMap.set(row.user_id, row);
	}

	const subsByUser = new Map<string, SubRow[]>();
	for (const s of (subs ?? []) as SubRow[]) {
		if (!reminderMap.has(s.user_id)) continue;
		const arr = subsByUser.get(s.user_id) ?? [];
		arr.push(s);
		subsByUser.set(s.user_id, arr);
	}

	const now = new Date();
	let checked = 0;
	let sent = 0;
	const errors: string[] = [];

	for (const [userId, subList] of subsByUser) {
		const r = reminderMap.get(userId);
		if (!r || !subList.length) continue;

		const { date: todayLocal, hour, minute } = zonedWallClock(now, r.user_timezone);
		if (!isInReminderWindow(hour, minute)) continue;

		checked++;

		if (r.last_reminder_for_user_date === todayLocal) continue;

		let needReminder: boolean;
		try {
			needReminder = await journalNotFilledForDate(admin, userId, todayLocal);
		} catch (e) {
			errors.push(`${userId}: ${e instanceof Error ? e.message : String(e)}`);
			continue;
		}
		if (!needReminder) continue;

		// Keep in sync with HABIT_PUSH_* in src/lib/push/reminders.ts and static/push-sw.js
		const payload = JSON.stringify({
			title: 'Привычки',
			body: 'Расскажи как прошел твой день.',
			url: '/journal'
		});

		let anySent = false;
		for (const sub of subList) {
			const pushSub = {
				endpoint: sub.endpoint,
				keys: { p256dh: sub.p256dh, auth: sub.auth }
			};
			try {
				await webpush.sendNotification(pushSub, payload);
				anySent = true;
			} catch (e: unknown) {
				const status = (e as { statusCode?: number })?.statusCode;
				if (status === 404 || status === 410) {
					await admin.from('push_subscriptions').delete().eq('id', sub.id);
				} else {
					errors.push(`push ${sub.id}: ${e instanceof Error ? e.message : String(e)}`);
				}
			}
		}

		if (anySent) {
			const { error: uErr } = await admin
				.from('user_push_reminders')
				.update({
					last_reminder_for_user_date: todayLocal,
					updated_at: new Date().toISOString()
				})
				.eq('user_id', userId);
			if (uErr) errors.push(`update ${userId}: ${uErr.message}`);
			else sent++;
		}
	}

	return new Response(
		JSON.stringify({
			ok: true,
			users_in_window: checked,
			reminders_sent: sent,
			errors: errors.length ? errors : undefined
		}),
		{ headers: { 'content-type': 'application/json' } }
	);
});
