import { db, type SyncTable } from '$db/dexie';
import { drainQueue } from '$db/sync';
import { supabase } from '$supabase/client';
import type { UUID } from '$supabase/types';
import { syncDebug } from '$utils/sync-debug';

interface ForcePushResult {
	habits: number;
	exercises: number;
	sets: number;
	cardio: number;
	journal: number;
	taskLists: number;
	tasks: number;
	subtasks: number;
}

async function upsertRows(
	table: string,
	rows: readonly unknown[],
	onConflict?: string
): Promise<void> {
	if (rows.length === 0) return;

	const query = supabase.from(table).upsert(rows as never, onConflict ? { onConflict } : undefined);
	const { error } = await query;
	if (error) throw error;
}

async function pendingUpsertIdsByTable(): Promise<Map<SyncTable, Set<string>>> {
	const tasks = await db.sync_queue.toArray();
	const byTable = new Map<SyncTable, Set<string>>();
	for (const task of tasks) {
		if (task.op !== 'upsert') continue;
		const id = (task.payload as { id?: unknown }).id;
		if (typeof id !== 'string' || id.length === 0) continue;
		const ids = byTable.get(task.table) ?? new Set<string>();
		ids.add(id);
		byTable.set(task.table, ids);
	}
	return byTable;
}

function onlyPending<T extends { id: string }>(
	rows: T[],
	pending: Map<SyncTable, Set<string>>,
	table: SyncTable
): T[] {
	const ids = pending.get(table);
	if (!ids) return [];
	return rows.filter((row) => ids.has(row.id));
}

export async function forcePushLocalData(userId: UUID): Promise<ForcePushResult> {
	syncDebug('force-push-start', { userId });

	const pending = await pendingUpsertIdsByTable();
	const [
		allHabits,
		allExercises,
		allSets,
		allCardio,
		allJournal,
		allTaskLists,
		allTasks,
		allSubtasks
	] = await Promise.all([
		db.habit_completions.where('user_id').equals(userId).toArray(),
		db.exercises.where('user_id').equals(userId).toArray(),
		db.workout_sets.where('user_id').equals(userId).toArray(),
		db.cardio_workouts.where('user_id').equals(userId).toArray(),
		db.journal_entries.where('user_id').equals(userId).toArray(),
		db.task_lists.where('user_id').equals(userId).toArray(),
		db.tasks.where('user_id').equals(userId).toArray(),
		db.task_subtasks.where('user_id').equals(userId).toArray()
	]);
	const habits = onlyPending(allHabits, pending, 'habit_completions');
	const exercises = onlyPending(allExercises, pending, 'exercises');
	const sets = onlyPending(allSets, pending, 'workout_sets');
	const cardio = onlyPending(allCardio, pending, 'cardio_workouts');
	const journal = onlyPending(allJournal, pending, 'journal_entries');
	const taskLists = onlyPending(allTaskLists, pending, 'task_lists');
	const tasks = onlyPending(allTasks, pending, 'tasks');
	const subtasks = onlyPending(allSubtasks, pending, 'task_subtasks');

	syncDebug('force-push-local-counts', {
		habits: habits.length,
		exercises: exercises.length,
		sets: sets.length,
		cardio: cardio.length,
		journal: journal.length,
		taskLists: taskLists.length,
		tasks: tasks.length,
		subtasks: subtasks.length
	});

	await upsertRows('exercises', exercises);
	await upsertRows('habit_completions', habits, 'user_id,habit_type,date');
	await upsertRows('journal_entries', journal, 'user_id,date');
	await upsertRows('workout_sets', sets);
	await upsertRows('cardio_workouts', cardio);
	// Lists before tasks (FK list_id), tasks before subtasks (FK task_id).
	await upsertRows('task_lists', taskLists);
	await upsertRows('tasks', tasks);
	await upsertRows('task_subtasks', subtasks);

	const result: ForcePushResult = {
		habits: habits.length,
		exercises: exercises.length,
		sets: sets.length,
		cardio: cardio.length,
		journal: journal.length,
		taskLists: taskLists.length,
		tasks: tasks.length,
		subtasks: subtasks.length
	};

	syncDebug('force-push-finish', { ...result });
	return result;
}

export async function resetLocalDataFromServer(): Promise<'reset' | 'pending'> {
	await drainQueue();
	if ((await db.sync_queue.count()) > 0) return 'pending';
	await db.transaction(
		'rw',
		[
			db.habit_completions,
			db.exercises,
			db.workout_sets,
			db.cardio_workouts,
			db.journal_entries,
			db.task_lists,
			db.tasks,
			db.task_subtasks
		],
		async () => {
			await Promise.all([
				db.habit_completions.clear(),
				db.exercises.clear(),
				db.workout_sets.clear(),
				db.cardio_workouts.clear(),
				db.journal_entries.clear(),
				db.task_lists.clear(),
				db.tasks.clear(),
				db.task_subtasks.clear()
			]);
		}
	);
	syncDebug('local-reset-from-server');
	return 'reset';
}
