export type HabitType = 'sport' | 'coding' | 'reading' | 'journal';
export type CardioType = 'warmup' | 'run' | 'swim' | 'basketball' | 'walk';

export type MuscleGroup = 'chest' | 'back' | 'legs' | 'arms' | 'other';

export const MUSCLE_GROUP_ORDER: readonly MuscleGroup[] = [
	'chest',
	'back',
	'legs',
	'arms',
	'other'
] as const;

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
	chest: 'Грудь',
	back: 'Спина',
	legs: 'Ноги',
	arms: 'Руки',
	other: 'Остальное'
};

export const CARDIO_ORDER: readonly CardioType[] = [
	'warmup',
	'run',
	'swim',
	'basketball',
	'walk'
] as const;

export const CARDIO_NO_DISTANCE: ReadonlySet<CardioType> = new Set<CardioType>([
	'warmup',
	'basketball'
]);

export type ISODate = string;
export type Timestamp = string;
export type UUID = string;

export interface HabitCompletion {
	id: UUID;
	user_id: UUID;
	habit_type: HabitType;
	date: ISODate;
	created_at: Timestamp;
}

export interface Exercise {
	id: UUID;
	user_id: UUID | null;
	name: string;
	muscle_group: string | null;
	is_preset: boolean;
	hidden: boolean;
	created_at: Timestamp;
}

export interface WorkoutSet {
	id: UUID;
	user_id: UUID;
	date: ISODate;
	exercise_id: UUID;
	weight: number;
	reps: number;
	set_number: number;
	note: string | null;
	created_at: Timestamp;
}

export interface CardioWorkout {
	id: UUID;
	user_id: UUID;
	date: ISODate;
	type: CardioType;
	duration_min: number;
	distance_km: number | null;
	note: string | null;
	created_at: Timestamp;
}

export interface JournalEntry {
	id: UUID;
	user_id: UUID;
	date: ISODate;
	content: string;
	mood: number | null;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface Database {
	__InternalSupabase: {
		PostgrestVersion: '12';
	};
	public: {
		Tables: {
			habit_completions: {
				Row: HabitCompletion;
				Insert: Omit<HabitCompletion, 'id' | 'created_at'> & {
					id?: UUID;
					created_at?: Timestamp;
				};
				Update: Partial<HabitCompletion>;
			};
			exercises: {
				Row: Exercise;
				Insert: Omit<Exercise, 'id' | 'created_at' | 'is_preset' | 'hidden'> & {
					id?: UUID;
					created_at?: Timestamp;
					is_preset?: boolean;
					hidden?: boolean;
				};
				Update: Partial<Exercise>;
			};
			workout_sets: {
				Row: WorkoutSet;
				Insert: Omit<WorkoutSet, 'id' | 'created_at'> & {
					id?: UUID;
					created_at?: Timestamp;
				};
				Update: Partial<WorkoutSet>;
			};
			cardio_workouts: {
				Row: CardioWorkout;
				Insert: Omit<CardioWorkout, 'id' | 'created_at'> & {
					id?: UUID;
					created_at?: Timestamp;
				};
				Update: Partial<CardioWorkout>;
			};
			journal_entries: {
				Row: JournalEntry;
				Insert: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'> & {
					id?: UUID;
					created_at?: Timestamp;
					updated_at?: Timestamp;
				};
				Update: Partial<JournalEntry>;
			};
		};
		Enums: {
			habit_type: HabitType;
			cardio_type: CardioType;
		};
	};
}

export const HABIT_ORDER: readonly HabitType[] = ['sport', 'coding', 'reading', 'journal'] as const;

export const HABIT_LABELS: Record<HabitType, string> = {
	sport: 'Спорт',
	coding: 'Кодинг',
	reading: 'Чтение',
	journal: 'Дневник'
};

export const CARDIO_LABELS: Record<CardioType, string> = {
	warmup: 'Зарядка',
	run: 'Бег',
	swim: 'Плавание',
	basketball: 'Баскетбол',
	walk: 'Ходьба'
};
