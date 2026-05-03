import { db, type SyncOp, type SyncTable, type SyncTask } from './dexie';
import { supabase, isSupabaseConfigured } from '$supabase/client';
import { syncDebug } from '$utils/sync-debug';

const TASK_TIMEOUT_MS = 10_000;
const MAX_BACKOFF_MS = 60_000;
const EMPTY_RESULT = { ok: 0, failed: 0 } as const;

type DrainResult = { ok: number; failed: number };

const queueListeners = new Set<() => void>();

function notifyQueueChanged(): void {
	for (const listener of queueListeners) {
		try {
			listener();
		} catch {
			/* listener errors are user code, ignore here */
		}
	}
}

export function subscribeSyncQueue(listener: () => void): () => void {
	queueListeners.add(listener);
	return () => {
		queueListeners.delete(listener);
	};
}

export async function enqueue(
	table: SyncTable,
	op: SyncOp,
	payload: Record<string, unknown>
): Promise<void> {
	const task: Omit<SyncTask, 'id'> = { table, op, payload, ts: Date.now(), attempts: 0 };
	const id = await db.sync_queue.add(task as SyncTask);
	syncDebug('queue-enqueue', { table, op, id });
	notifyQueueChanged();
}

let drainingPromise: Promise<DrainResult> | null = null;

export async function drainQueue(): Promise<DrainResult> {
	if (!isSupabaseConfigured) {
		syncDebug('queue-skip-unconfigured');
		return EMPTY_RESULT;
	}
	if (typeof navigator !== 'undefined' && navigator.onLine === false) {
		syncDebug('queue-skip-offline');
		return EMPTY_RESULT;
	}
	if (drainingPromise) {
		syncDebug('queue-reuse-active-drain');
		return drainingPromise;
	}

	drainingPromise = drainQueueNow().finally(() => {
		drainingPromise = null;
		notifyQueueChanged();
	});

	return drainingPromise;
}

export async function hasPendingSync(table: SyncTable): Promise<boolean> {
	const pending = await db.sync_queue.where('table').equals(table).first();
	return pending !== undefined;
}

export async function pendingSyncCount(): Promise<number> {
	return db.sync_queue.count();
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err) => {
				clearTimeout(timer);
				reject(err);
			}
		);
	});
}

async function drainQueueNow(): Promise<DrainResult> {
	let ok = 0;
	let failed = 0;

	const tasks = await db.sync_queue.orderBy('ts').limit(50).toArray();
	syncDebug('queue-drain-start', { count: tasks.length });
	for (const task of tasks) {
		const id = task.id;
		if (id === undefined) continue;
		if (typeof navigator !== 'undefined' && navigator.onLine === false) {
			syncDebug('queue-drain-abort-offline');
			break;
		}
		try {
			await withTimeout(runTask(task), TASK_TIMEOUT_MS, `task-${task.table}-${task.op}`);
			await db.sync_queue.delete(id);
			notifyQueueChanged();
			syncDebug('queue-task-ok', { id, table: task.table, op: task.op });
			ok++;
		} catch (err) {
			failed++;
			const attempts = task.attempts + 1;
			const message = err instanceof Error ? err.message : String(err);
			syncDebug('queue-task-failed', {
				id,
				table: task.table,
				op: task.op,
				attempts,
				error: message
			});
			await db.sync_queue.update(id, { attempts, last_error: message });
			const backoff = Math.min(2_000 * 2 ** task.attempts, MAX_BACKOFF_MS);
			await new Promise((r) => setTimeout(r, backoff));
			if (typeof navigator !== 'undefined' && navigator.onLine === false) {
				syncDebug('queue-drain-abort-offline-after-fail');
				break;
			}
		}
	}
	syncDebug('queue-drain-finish', { ok, failed });
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
	syncDebug('queue-watchers-start', {
		online: navigator.onLine,
		visibility: document.visibilityState
	});
	const onOnline = () => {
		syncDebug('queue-online-event');
		void drainQueue();
	};
	const onFocus = () => {
		syncDebug('queue-focus-event');
		void drainQueue();
	};
	const onVisibility = () => {
		if (document.visibilityState === 'visible') {
			syncDebug('queue-visible-event');
			void drainQueue();
		}
	};
	window.addEventListener('online', onOnline);
	window.addEventListener('focus', onFocus);
	document.addEventListener('visibilitychange', onVisibility);
	const interval = window.setInterval(() => {
		void drainQueue();
	}, 30_000);
	void drainQueue();
	stopWatchers = () => {
		syncDebug('queue-watchers-stop');
		window.removeEventListener('online', onOnline);
		window.removeEventListener('focus', onFocus);
		document.removeEventListener('visibilitychange', onVisibility);
		window.clearInterval(interval);
		stopWatchers = null;
	};
	return stopWatchers;
}
