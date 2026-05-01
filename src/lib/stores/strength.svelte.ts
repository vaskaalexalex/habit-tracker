import { db } from '$db/dexie';
import { drainQueue, enqueue, hasPendingSync } from '$db/sync';
import { isSupabaseConfigured } from '$supabase/client';
import {
	createExercise as apiCreate,
	deleteExercise as apiDelete,
	fetchExercises,
	fetchWorkoutSets,
	insertWorkoutSet,
	deleteWorkoutSet,
	setExerciseHidden as apiSetHidden
} from '$supabase/api';
import type { Exercise, ISODate, UUID, WorkoutSet } from '$supabase/types';
import { uuid } from '$utils/uuid';
import { isoToday, lastNMonthsRange, toISO } from '$utils/dates';
import { mergeByKey } from '$utils/merge';

class StrengthStore {
	exercises = $state<Exercise[]>([]);
	sets = $state<WorkoutSet[]>([]);
	loading = $state<boolean>(false);
	loaded = $state<boolean>(false);

	#userId: UUID | null = null;

	setUser(userId: UUID | null): void {
		if (this.#userId === userId) return;
		this.#userId = userId;
		this.exercises = [];
		this.sets = [];
		this.loaded = false;
		if (userId) void this.refresh();
	}

	async refresh(monthsBack = 6): Promise<void> {
		if (!this.#userId) return;
		this.loading = true;
		const { from, to } = lastNMonthsRange(monthsBack);
		const fromISO = toISO(from);
		const toISO2 = toISO(to);
		try {
			const localEx = await db.exercises.toArray();
			const localSets = await db.workout_sets
				.where('[user_id+date]')
				.between([this.#userId, fromISO], [this.#userId, toISO2], true, true)
				.toArray();
			this.exercises = localEx;
			this.sets = localSets;

			if (isSupabaseConfigured) {
				await drainQueue();
				const [remoteEx, remoteSets] = await Promise.all([
					fetchExercises(this.#userId),
					fetchWorkoutSets(this.#userId, fromISO, toISO2)
				]);
				await db.exercises.bulkPut(remoteEx);
				await db.workout_sets.bulkPut(remoteSets);
				this.exercises = (await hasPendingSync('exercises'))
					? mergeByKey(localEx, remoteEx, (item) => item.id)
					: remoteEx;
				this.sets = (await hasPendingSync('workout_sets'))
					? mergeByKey(localSets, remoteSets, (item) => item.id)
					: remoteSets;
			}
			this.loaded = true;
		} catch (err) {
			console.error('[strength.refresh]', err);
		} finally {
			this.loading = false;
		}
	}

	visibleExercises(): Exercise[] {
		return this.exercises.filter((e) => !e.hidden);
	}

	setsForDate(date: ISODate): WorkoutSet[] {
		return this.sets.filter((s) => s.date === date);
	}

	setsByExercise(exerciseId: UUID): WorkoutSet[] {
		return this.sets
			.filter((s) => s.exercise_id === exerciseId)
			.sort((a, b) => a.date.localeCompare(b.date));
	}

	nextSetNumber(exerciseId: UUID, date: ISODate): number {
		const today = this.sets.filter((s) => s.exercise_id === exerciseId && s.date === date);
		return today.length === 0 ? 1 : Math.max(...today.map((s) => s.set_number)) + 1;
	}

	async createExercise(name: string, muscleGroup?: string | null): Promise<Exercise> {
		if (!this.#userId) throw new Error('not authenticated');
		const row: Exercise = {
			id: uuid(),
			user_id: this.#userId,
			name: name.trim(),
			muscle_group: muscleGroup ?? null,
			is_preset: false,
			hidden: false,
			created_at: new Date().toISOString()
		};
		this.exercises = [...this.exercises, row];
		await db.exercises.put(row);
		if (isSupabaseConfigured) {
			try {
				const real = await apiCreate({
					user_id: this.#userId,
					name: row.name,
					muscle_group: row.muscle_group
				});
				await db.exercises.delete(row.id);
				await db.exercises.put(real);
				this.exercises = this.exercises.map((e) => (e.id === row.id ? real : e));
				return real;
			} catch (err) {
				console.error('[strength.createExercise:remote]', err);
				await enqueue('exercises', 'upsert', row as unknown as Record<string, unknown>);
				return row;
			}
		}
		await enqueue('exercises', 'upsert', row as unknown as Record<string, unknown>);
		return row;
	}

	async setExerciseHidden(id: UUID, hidden: boolean): Promise<void> {
		const ex = this.exercises.find((e) => e.id === id);
		if (!ex || ex.is_preset || ex.user_id !== this.#userId) return;
		const next: Exercise = { ...ex, hidden };
		this.exercises = this.exercises.map((e) => (e.id === id ? next : e));
		await db.exercises.put(next);
		if (isSupabaseConfigured) {
			try {
				await apiSetHidden(id, hidden);
			} catch (err) {
				console.error('[strength.setExerciseHidden]', err);
				await enqueue('exercises', 'upsert', next as unknown as Record<string, unknown>);
			}
		}
	}

	async deleteExercise(id: UUID): Promise<void> {
		const ex = this.exercises.find((e) => e.id === id);
		if (!ex || ex.is_preset) return;
		this.exercises = this.exercises.filter((e) => e.id !== id);
		await db.exercises.delete(id);
		if (isSupabaseConfigured) {
			try {
				await apiDelete(id);
			} catch (err) {
				console.error('[strength.deleteExercise]', err);
				await enqueue('exercises', 'delete', { id });
			}
		} else {
			await enqueue('exercises', 'delete', { id });
		}
	}

	async addSet(input: {
		exercise_id: UUID;
		weight: number;
		reps: number;
		date?: ISODate;
		note?: string | null;
	}): Promise<WorkoutSet> {
		if (!this.#userId) throw new Error('not authenticated');
		const date = input.date ?? isoToday();
		const set_number = this.nextSetNumber(input.exercise_id, date);
		const row: WorkoutSet = {
			id: uuid(),
			user_id: this.#userId,
			date,
			exercise_id: input.exercise_id,
			weight: input.weight,
			reps: input.reps,
			set_number,
			note: input.note ?? null,
			created_at: new Date().toISOString()
		};
		this.sets = [...this.sets, row];
		await db.workout_sets.put(row);
		if (isSupabaseConfigured) {
			try {
				await insertWorkoutSet(row);
			} catch (err) {
				console.error('[strength.addSet]', err);
				await enqueue('workout_sets', 'upsert', row as unknown as Record<string, unknown>);
			}
		} else {
			await enqueue('workout_sets', 'upsert', row as unknown as Record<string, unknown>);
		}
		void drainQueue();
		return row;
	}

	async deleteSet(id: UUID): Promise<void> {
		this.sets = this.sets.filter((s) => s.id !== id);
		await db.workout_sets.delete(id);
		if (isSupabaseConfigured) {
			try {
				await deleteWorkoutSet(id);
			} catch (err) {
				console.error('[strength.deleteSet]', err);
				await enqueue('workout_sets', 'delete', { id });
			}
		} else {
			await enqueue('workout_sets', 'delete', { id });
		}
	}
}

export const strengthStore = new StrengthStore();
