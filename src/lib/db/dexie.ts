import Dexie, { type Table } from 'dexie';
import type {
	CardioWorkout,
	Exercise,
	HabitCompletion,
	JournalEntry,
	WorkoutSet
} from '$supabase/types';

export type SyncOp = 'upsert' | 'delete';

export type SyncTable =
	| 'habit_completions'
	| 'exercises'
	| 'workout_sets'
	| 'cardio_workouts'
	| 'journal_entries';

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
	}
}

export const db = new HabitDB();
