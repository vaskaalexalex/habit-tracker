import { db } from '$db/dexie';
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

export async function forcePushLocalData(userId: UUID): Promise<ForcePushResult> {
	syncDebug('force-push-start', { userId });

	const [habits, exercises, sets, cardio, journal, taskLists, tasks, subtasks] = await Promise.all([
		db.habit_completions.where('user_id').equals(userId).toArray(),
		db.exercises.where('user_id').equals(userId).toArray(),
		db.workout_sets.where('user_id').equals(userId).toArray(),
		db.cardio_workouts.where('user_id').equals(userId).toArray(),
		db.journal_entries.where('user_id').equals(userId).toArray(),
		db.task_lists.where('user_id').equals(userId).toArray(),
		db.tasks.where('user_id').equals(userId).toArray(),
		db.task_subtasks.where('user_id').equals(userId).toArray()
	]);

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
