/**
 * Scheduled Web Push: ~3h before local midnight (21:00 in user_timezone).
 * Sends only if the journal entry for that calendar day is not “meaningful”.
 * Cron: Authorization: Bearer <CRON_SECRET>.
 * Profile test: POST body { test_user_id, skip_window: true, test: true } + user JWT.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0';
import webpush from 'npm:web-push@3.6.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

type ReminderRow = {
	user_id: string;
	reminders_enabled: boolean;
	user_timezone: string;
	app_base_path: string | null;
	last_reminder_for_user_date: string | null;
};

type SubRow = {
	id: string;
	user_id: string;
	endpoint: string;
	p256dh: string;
	auth: string;
};

type InvokeBody = {
	test_user_id?: string;
	skip_window?: boolean;
	test?: boolean;
};

const DEFAULT_APP_BASE_PATH = '/habit-tracker';

function journalPushUrl(appBasePath: string | null | undefined): string {
	const b = (appBasePath ?? '').replace(/\/$/, '');
	const base = b || DEFAULT_APP_BASE_PATH;
	return `${base}/journal`;
}

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

function localMinutesFromMidnight(hour: number, minute: number): number {
	return hour * 60 + minute;
}

function isInReminderWindow(hour: number, minute: number): boolean {
	const m = localMinutesFromMidnight(hour, minute);
	return m >= 21 * 60 - 15 && m <= 21 * 60 + 15;
}

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
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders });
	}

	const authHeader = req.headers.get('authorization') ?? '';
	const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

	let body: InvokeBody = {};
	if (req.method === 'POST') {
		try {
			body = (await req.json()) as InvokeBody;
		} catch {
			body = {};
		}
	}

	const testUserId = typeof body.test_user_id === 'string' ? body.test_user_id.trim() : '';
	const isProfileTest =
		body.test === true && body.skip_window === true && testUserId.length > 0;

	const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
	const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
	const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:habit-tracker@localhost';

	const admin = createClient(supabaseUrl, serviceKey);

	const { data: cfgRaw, error: cfgErr } = await admin.rpc('get_edge_push_config');
	const cfg =
		!cfgErr && cfgRaw && typeof cfgRaw === 'object'
			? (cfgRaw as { vapid_public?: string | null; vapid_private?: string | null; cron_secret?: string | null })
			: null;

	const cronSecret =
		(Deno.env.get('CRON_SECRET') ?? '').trim() || (cfg?.cron_secret ?? '').trim();
	const authorizedAsCron = !cronSecret || bearer === cronSecret;

	if (isProfileTest) {
		if (!anonKey) {
			return jsonResponse({ error: 'missing_anon_key' }, 500);
		}
		const userClient = createClient(supabaseUrl, anonKey, {
			global: { headers: { Authorization: authHeader } }
		});
		const { data: userData, error: userErr } = await userClient.auth.getUser();
		if (userErr || !userData.user || userData.user.id !== testUserId) {
			return jsonResponse({ error: 'unauthorized' }, 401);
		}
	} else if (!authorizedAsCron) {
		return jsonResponse({ error: 'unauthorized' }, 401);
	}

	let vapidPublic = (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim();
	let vapidPrivate = (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').trim();
	if (!vapidPublic || !vapidPrivate) {
		vapidPublic = (cfg?.vapid_public ?? '').trim();
		vapidPrivate = (cfg?.vapid_private ?? '').trim();
	}
	if (!vapidPublic || !vapidPrivate) {
		return jsonResponse({ error: 'missing_vapid_keys' }, 500);
	}

	webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

	let remindersQuery = admin
		.from('user_push_reminders')
		.select(
			'user_id, reminders_enabled, user_timezone, app_base_path, last_reminder_for_user_date'
		)
		.eq('reminders_enabled', true);

	if (isProfileTest) {
		remindersQuery = remindersQuery.eq('user_id', testUserId);
	}

	const { data: reminders, error: rErr } = await remindersQuery;
	if (rErr) {
		return jsonResponse({ error: rErr.message }, 500);
	}

	let subsQuery = admin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth');
	if (isProfileTest) {
		subsQuery = subsQuery.eq('user_id', testUserId);
	}

	const { data: subs, error: sErr } = await subsQuery;
	if (sErr) {
		return jsonResponse({ error: sErr.message }, 500);
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

		if (!isProfileTest) {
			if (!isInReminderWindow(hour, minute)) continue;
			checked++;
			if (r.last_reminder_for_user_date === todayLocal) continue;
		} else {
			checked++;
		}

		if (!isProfileTest) {
			let needReminder: boolean;
			try {
				needReminder = await journalNotFilledForDate(admin, userId, todayLocal);
			} catch (e) {
				errors.push(`${userId}: ${e instanceof Error ? e.message : String(e)}`);
				continue;
			}
			if (!needReminder) continue;
		}

		const payload = JSON.stringify({
			title: 'Привычки',
			body: 'Расскажи как прошел твой день.',
			url: journalPushUrl(r.app_base_path)
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
			if (!isProfileTest) {
				const { error: uErr } = await admin
					.from('user_push_reminders')
					.update({
						last_reminder_for_user_date: todayLocal,
						updated_at: new Date().toISOString()
					})
					.eq('user_id', userId);
				if (uErr) errors.push(`update ${userId}: ${uErr.message}`);
			}
			sent++;
		}
	}

	return jsonResponse({
		ok: true,
		users_in_window: checked,
		reminders_sent: sent,
		errors: errors.length ? errors : undefined
	});
});
