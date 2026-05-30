import { db, type SyncTable } from './dexie';
import { enqueue } from './sync';
import { toISO } from '$utils/dates';
import { syncDebug } from '$utils/sync-debug';
import type {
	CardioWorkout,
	Exercise,
	HabitCompletion,
	JournalEntry,
	Subtask,
	Task,
	TaskList,
	WorkoutSet
} from '$supabase/types';

/** Bump when the on-disk backup shape changes incompatibly. */
export const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_APP_ID = 'habit-tracker';

export interface BackupData {
	habit_completions: HabitCompletion[];
	exercises: Exercise[];
	workout_sets: WorkoutSet[];
	cardio_workouts: CardioWorkout[];
	journal_entries: JournalEntry[];
	task_lists: TaskList[];
	tasks: Task[];
	task_subtasks: Subtask[];
}

export interface BackupFile {
	app: typeof BACKUP_APP_ID;
	schema_version: number;
	exported_at: string;
	data: BackupData;
}

export type TableCounts = Record<keyof BackupData, number>;

function countRows(data: BackupData): TableCounts {
	return {
		habit_completions: data.habit_completions.length,
		exercises: data.exercises.length,
		workout_sets: data.workout_sets.length,
		cardio_workouts: data.cardio_workouts.length,
		journal_entries: data.journal_entries.length,
		task_lists: data.task_lists.length,
		tasks: data.tasks.length,
		task_subtasks: data.task_subtasks.length
	};
}

/** Snapshot every Dexie data table (sync_queue is intentionally excluded). */
export async function buildBackup(): Promise<BackupFile> {
	const [
		habit_completions,
		exercises,
		workout_sets,
		cardio_workouts,
		journal_entries,
		task_lists,
		tasks,
		task_subtasks
	] = await Promise.all([
		db.habit_completions.toArray(),
		db.exercises.toArray(),
		db.workout_sets.toArray(),
		db.cardio_workouts.toArray(),
		db.journal_entries.toArray(),
		db.task_lists.toArray(),
		db.tasks.toArray(),
		db.task_subtasks.toArray()
	]);

	const data: BackupData = {
		habit_completions,
		exercises,
		workout_sets,
		cardio_workouts,
		journal_entries,
		task_lists,
		tasks,
		task_subtasks
	};

	syncDebug('backup-build', countRows(data));

	return {
		app: BACKUP_APP_ID,
		schema_version: BACKUP_SCHEMA_VERSION,
		exported_at: new Date().toISOString(),
		data
	};
}

/** Build a downloadable JSON blob plus a dated filename. */
export async function exportBackup(): Promise<{
	blob: Blob;
	filename: string;
	counts: TableCounts;
}> {
	const backup = await buildBackup();
	const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
	const filename = `habit-backup-${toISO(new Date())}.json`;
	return { blob, filename, counts: countRows(backup.data) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray<T>(value: unknown): T[] {
	return Array.isArray(value) ? (value as T[]) : [];
}

/** Validate + normalize parsed JSON into a BackupData (tolerates missing tables). */
function parseBackup(raw: string): BackupData {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error('Файл не является корректным JSON');
	}
	if (!isRecord(parsed) || parsed.app !== BACKUP_APP_ID || !isRecord(parsed.data)) {
		throw new Error('Это не файл резервной копии Habit');
	}
	const version = parsed.schema_version;
	if (typeof version !== 'number' || version > BACKUP_SCHEMA_VERSION) {
		throw new Error('Версия резервной копии не поддерживается');
	}
	const d = parsed.data;
	return {
		habit_completions: asArray<HabitCompletion>(d.habit_completions),
		exercises: asArray<Exercise>(d.exercises),
		workout_sets: asArray<WorkoutSet>(d.workout_sets),
		cardio_workouts: asArray<CardioWorkout>(d.cardio_workouts),
		journal_entries: asArray<JournalEntry>(d.journal_entries),
		task_lists: asArray<TaskList>(d.task_lists),
		tasks: asArray<Task>(d.tasks),
		task_subtasks: asArray<Subtask>(d.task_subtasks)
	};
}

function asPayload(row: unknown): Record<string, unknown> {
	return row as Record<string, unknown>;
}

/**
 * Restore a backup into Dexie (merge via bulkPut, never wipes existing rows),
 * then queue the imported rows for cloud upload via the sync queue.
 * Order respects FKs so the cloud upserts succeed: lists -> tasks -> subtasks.
 */
export async function importBackup(file: File | string): Promise<TableCounts> {
	const raw = typeof file === 'string' ? file : await file.text();
	const data = parseBackup(raw);

	await Promise.all([
		db.habit_completions.bulkPut(data.habit_completions),
		db.exercises.bulkPut(data.exercises),
		db.workout_sets.bulkPut(data.workout_sets),
		db.cardio_workouts.bulkPut(data.cardio_workouts),
		db.journal_entries.bulkPut(data.journal_entries),
		db.task_lists.bulkPut(data.task_lists),
		db.tasks.bulkPut(data.tasks),
		db.task_subtasks.bulkPut(data.task_subtasks)
	]);

	// Queue user-owned rows for cloud sync. Presets (user_id null) live on the
	// server already, so we never push them.
	await enqueueAll(
		'exercises',
		data.exercises.filter((e) => !e.is_preset && e.user_id)
	);
	await enqueueAll('habit_completions', data.habit_completions);
	await enqueueAll('journal_entries', data.journal_entries);
	await enqueueAll('workout_sets', data.workout_sets);
	await enqueueAll('cardio_workouts', data.cardio_workouts);
	await enqueueAll('task_lists', data.task_lists);
	await enqueueAll('tasks', data.tasks);
	await enqueueAll('task_subtasks', data.task_subtasks);

	const counts = countRows(data);
	syncDebug('backup-import', counts);
	return counts;
}

async function enqueueAll(table: SyncTable, rows: readonly unknown[]): Promise<void> {
	for (const row of rows) {
		await enqueue(table, 'upsert', asPayload(row));
	}
}
