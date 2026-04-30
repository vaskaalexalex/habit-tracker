import { db, type SyncOp, type SyncTable, type SyncTask } from './dexie';
import { supabase, isSupabaseConfigured } from '$supabase/client';

const MAX_ATTEMPTS = 6;

export async function enqueue(
	table: SyncTable,
	op: SyncOp,
	payload: Record<string, unknown>
): Promise<void> {
	const task: Omit<SyncTask, 'id'> = { table, op, payload, ts: Date.now(), attempts: 0 };
	await db.sync_queue.add(task as SyncTask);
}

let draining = false;

export async function drainQueue(): Promise<{ ok: number; failed: number }> {
	if (!isSupabaseConfigured) return { ok: 0, failed: 0 };
	if (draining) return { ok: 0, failed: 0 };
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: 0, failed: 0 };

	draining = true;
	let ok = 0;
	let failed = 0;
	try {
		const tasks = await db.sync_queue.orderBy('ts').limit(50).toArray();
		for (const task of tasks) {
			const id = task.id;
			if (id === undefined) continue;
			try {
				await runTask(task);
				await db.sync_queue.delete(id);
				ok++;
			} catch (err) {
				failed++;
				const attempts = task.attempts + 1;
				if (attempts >= MAX_ATTEMPTS) {
					await db.sync_queue.delete(id);
				} else {
					await db.sync_queue.update(id, {
						attempts,
						last_error: err instanceof Error ? err.message : String(err)
					});
				}
				const backoff = Math.min(2_000 * 2 ** task.attempts, 60_000);
				await new Promise((r) => setTimeout(r, backoff));
			}
		}
	} finally {
		draining = false;
	}
	return { ok, failed };
}

async function runTask(task: SyncTask): Promise<void> {
	const { table, op, payload } = task;

	if (op === 'upsert') {
		if (table === 'habit_completions') {
			const { error } = await supabase
				.from('habit_completions')
				.upsert(payload as never, { onConflict: 'user_id,habit_type,date' });
			if (error) throw error;
			return;
		}
		if (table === 'journal_entries') {
			const { error } = await supabase
				.from('journal_entries')
				.upsert(payload as never, { onConflict: 'user_id,date' });
			if (error) throw error;
			return;
		}
		const { error } = await supabase.from(table).upsert(payload as never);
		if (error) throw error;
		return;
	}

	if (op === 'delete') {
		const id = (payload as { id?: string }).id;
		if (table === 'habit_completions') {
			const p = payload as { user_id: string; habit_type: string; date: string };
			const { error } = await supabase
				.from('habit_completions')
				.delete()
				.eq('user_id', p.user_id)
				.eq('habit_type', p.habit_type as never)
				.eq('date', p.date);
			if (error) throw error;
			return;
		}
		if (!id) throw new Error(`delete ${table}: missing id`);
		const { error } = await supabase.from(table).delete().eq('id', id);
		if (error) throw error;
	}
}

let stopWatchers: (() => void) | null = null;

export function startSyncWatchers(): () => void {
	if (typeof window === 'undefined') return () => undefined;
	if (stopWatchers) return stopWatchers;
	const onOnline = () => {
		void drainQueue();
	};
	window.addEventListener('online', onOnline);
	const interval = window.setInterval(() => {
		void drainQueue();
	}, 30_000);
	void drainQueue();
	stopWatchers = () => {
		window.removeEventListener('online', onOnline);
		window.clearInterval(interval);
		stopWatchers = null;
	};
	return stopWatchers;
}
