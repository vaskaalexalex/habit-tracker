import { supabase } from './client';
import type {
	CardioWorkout,
	Exercise,
	HabitCompletion,
	HabitType,
	ISODate,
	JournalEntry,
	UUID,
	WorkoutSet,
	UserProfile
} from './types';

export async function fetchHabitCompletionsRange(
	userId: UUID,
	from: ISODate,
	to: ISODate
): Promise<HabitCompletion[]> {
	const { data, error } = await supabase
		.from('habit_completions')
		.select('*')
		.eq('user_id', userId)
		.gte('date', from)
		.lte('date', to)
		.order('date', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function upsertHabitCompletion(row: {
	user_id: UUID;
	habit_type: HabitType;
	date: ISODate;
}): Promise<void> {
	const { error } = await supabase
		.from('habit_completions')
		.upsert(row, { onConflict: 'user_id,habit_type,date', ignoreDuplicates: false });
	if (error) throw error;
}

export async function deleteHabitCompletion(row: {
	user_id: UUID;
	habit_type: HabitType;
	date: ISODate;
}): Promise<void> {
	const { error } = await supabase
		.from('habit_completions')
		.delete()
		.eq('user_id', row.user_id)
		.eq('habit_type', row.habit_type)
		.eq('date', row.date);
	if (error) throw error;
}

export async function fetchExercises(_userId: UUID): Promise<Exercise[]> {
	const { data, error } = await supabase
		.from('exercises')
		.select('*')
		.order('muscle_group', { ascending: true })
		.order('sort_order', { ascending: true, nullsFirst: false })
		.order('name', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function createExercise(input: {
	user_id: UUID;
	name: string;
	muscle_group?: string | null;
}): Promise<Exercise> {
	const { data, error } = await supabase
		.from('exercises')
		.insert({
			user_id: input.user_id,
			name: input.name,
			muscle_group: input.muscle_group ?? null,
			is_preset: false,
			hidden: false
		})
		.select('*')
		.single();
	if (error) throw error;
	return data;
}

export async function setExerciseHidden(id: UUID, hidden: boolean): Promise<void> {
	const { error } = await supabase.from('exercises').update({ hidden }).eq('id', id);
	if (error) throw error;
}

export async function deleteExercise(id: UUID): Promise<void> {
	const { error } = await supabase.from('exercises').delete().eq('id', id);
	if (error) throw error;
}

export async function fetchWorkoutSets(
	userId: UUID,
	from: ISODate,
	to: ISODate
): Promise<WorkoutSet[]> {
	const { data, error } = await supabase
		.from('workout_sets')
		.select('*')
		.eq('user_id', userId)
		.gte('date', from)
		.lte('date', to)
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

export async function insertWorkoutSet(row: WorkoutSet): Promise<void> {
	const { error } = await supabase.from('workout_sets').insert(row);
	if (error) throw error;
}

export async function deleteWorkoutSet(id: UUID): Promise<void> {
	const { error } = await supabase.from('workout_sets').delete().eq('id', id);
	if (error) throw error;
}

export async function fetchCardio(
	userId: UUID,
	from: ISODate,
	to: ISODate
): Promise<CardioWorkout[]> {
	const { data, error } = await supabase
		.from('cardio_workouts')
		.select('*')
		.eq('user_id', userId)
		.gte('date', from)
		.lte('date', to)
		.order('date', { ascending: false });
	if (error) throw error;
	return data ?? [];
}

export async function insertCardio(row: CardioWorkout): Promise<void> {
	const { error } = await supabase.from('cardio_workouts').insert(row);
	if (error) throw error;
}

export async function deleteCardio(id: UUID): Promise<void> {
	const { error } = await supabase.from('cardio_workouts').delete().eq('id', id);
	if (error) throw error;
}

export async function fetchJournal(
	userId: UUID,
	from: ISODate,
	to: ISODate
): Promise<JournalEntry[]> {
	const { data, error } = await supabase
		.from('journal_entries')
		.select('*')
		.eq('user_id', userId)
		.gte('date', from)
		.lte('date', to)
		.order('date', { ascending: false });
	if (error) throw error;
	return data ?? [];
}

export async function fetchJournalDay(userId: UUID, date: ISODate): Promise<JournalEntry | null> {
	const { data, error } = await supabase
		.from('journal_entries')
		.select('*')
		.eq('user_id', userId)
		.eq('date', date)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function upsertJournal(row: JournalEntry): Promise<void> {
	const { error } = await supabase
		.from('journal_entries')
		.upsert(row, { onConflict: 'user_id,date' });
	if (error) throw error;
}

export async function fetchUserProfile(userId: UUID): Promise<UserProfile | null> {
	const { data, error } = await supabase
		.from('user_profiles')
		.select('*')
		.eq('id', userId)
		.maybeSingle();
	if (error) throw error;
	return data;
}

export async function upsertUserProfile(row: {
	id: UUID;
	display_name: string;
}): Promise<void> {
	const { error } = await supabase.from('user_profiles').upsert(
		{
			id: row.id,
			display_name: row.display_name,
			updated_at: new Date().toISOString()
		},
		{ onConflict: 'id' }
	);
	if (error) throw error;
}
