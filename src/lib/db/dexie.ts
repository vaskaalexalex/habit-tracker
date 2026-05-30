import Dexie, { type Table } from 'dexie';
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

export type SyncOp = 'upsert' | 'delete';

export type SyncTable =
	| 'habit_completions'
	| 'exercises'
	| 'workout_sets'
	| 'cardio_workouts'
	| 'journal_entries'
	| 'task_lists'
	| 'tasks'
	| 'task_subtasks';

export interface SyncTask {
	id?: number;
	op: SyncOp;
	table: SyncTable;
	payload: Record<string, unknown>;
	ts: number;
	attempts: number;
	last_error?: string;
}

export class HabitDB extends Dexie {
	habit_completions!: Table<HabitCompletion, string>;
	exercises!: Table<Exercise, string>;
	workout_sets!: Table<WorkoutSet, string>;
	cardio_workouts!: Table<CardioWorkout, string>;
	journal_entries!: Table<JournalEntry, string>;
	task_lists!: Table<TaskList, string>;
	tasks!: Table<Task, string>;
	task_subtasks!: Table<Subtask, string>;
	sync_queue!: Table<SyncTask, number>;

	constructor() {
		super('habit-tracker');
		this.version(1).stores({
			habit_completions: 'id, user_id, [user_id+date], [user_id+habit_type+date], date',
			exercises: 'id, user_id, name, is_preset',
			workout_sets: 'id, user_id, [user_id+date], [user_id+exercise_id], date, exercise_id',
			cardio_workouts: 'id, user_id, [user_id+date], date',
			journal_entries: 'id, user_id, [user_id+date], date',
			sync_queue: '++id, ts, table'
		});
		this.version(2).stores({
			task_lists: 'id, user_id, [user_id+sort_order]',
			tasks: 'id, user_id, list_id, [user_id+status], [user_id+list_id], status',
			task_subtasks: 'id, user_id, task_id, [task_id+sort_order]'
		});
	}
}

export const db = new HabitDB();
