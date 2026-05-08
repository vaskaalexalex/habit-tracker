import { db, type SyncTable } from '$db/dexie';
import { drainQueue, enqueue } from '$db/sync';
import { isSupabaseConfigured } from '$supabase/client';
import { fetchExercises, fetchWorkoutSets } from '$supabase/api';
import type { Exercise, ISODate, UUID, WorkoutSet } from '$supabase/types';
import { uuid } from '$utils/uuid';
import { isoToday, lastNMonthsRange, toISO } from '$utils/dates';
import { syncDebug } from '$utils/sync-debug';

/** IDs still waiting in sync queue for upsert (offline / in-flight). */
async function pendingUpsertIds(table: SyncTable): Promise<Set<string>> {
	const tasks = await db.sync_queue.where('table').equals(table).toArray();
	const ids = new Set<string>();
	for (const t of tasks) {
		if (t.op !== 'upsert') continue;
		const id = (t.payload as { id?: string }).id;
		if (typeof id === 'string' && id.length > 0) ids.add(id);
	}
	return ids;
}

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
	}

	async refresh(monthsBack = 6): Promise<void> {
		if (!this.#userId) return;
		this.loading = true;
		const { from, to } = lastNMonthsRange(monthsBack);
		const fromISO = toISO(from);
		const toISO2 = toISO(to);
		syncDebug('strength-refresh-start', { userId: this.#userId, from: fromISO, to: toISO2 });
		let localEx: Exercise[] = [];
		let localSets: WorkoutSet[] = [];
		try {
			localEx = await db.exercises.toArray();
			localSets = await db.workout_sets
				.where('[user_id+date]')
				.between([this.#userId, fromISO], [this.#userId, toISO2], true, true)
				.toArray();
			this.exercises = localEx;
			this.sets = localSets;
			this.loaded = true;
			syncDebug('strength-local-loaded', { exercises: localEx.length, sets: localSets.length });
		} catch (err) {
			syncDebug('strength-local-error', {
				error: err instanceof Error ? err.message : String(err)
			});
			console.error('[strength.refresh:local]', err);
		}

		const online = typeof navigator === 'undefined' || navigator.onLine !== false;
		if (isSupabaseConfigured && online) {
			try {
				await drainQueue();
				const [remoteEx, remoteSets] = await Promise.all([
					fetchExercises(this.#userId),
					fetchWorkoutSets(this.#userId, fromISO, toISO2)
				]);
				syncDebug('strength-remote-loaded', {
					exercises: remoteEx.length,
					sets: remoteSets.length
				});
				const pendingExIds = await pendingUpsertIds('exercises');
				const pendingSetIds = await pendingUpsertIds('workout_sets');
				const remoteExIds = new Set(remoteEx.map((e) => e.id));
				const remoteSetIds = new Set(remoteSets.map((s) => s.id));
				const unsyncedExercises = localEx.filter(
					(e) =>
						pendingExIds.has(e.id) &&
						!remoteExIds.has(e.id) &&
						e.user_id === this.#userId &&
						!e.is_preset
				);
				const mergedExercises = [...remoteEx, ...unsyncedExercises];
				await db.exercises.clear();
				await db.exercises.bulkPut(mergedExercises);
				this.exercises = mergedExercises;

				const unsyncedSets = localSets.filter(
					(s) => pendingSetIds.has(s.id) && !remoteSetIds.has(s.id)
				);
				const mergedSets = [...remoteSets, ...unsyncedSets];
				for (const s of localSets) {
					if (!mergedSets.some((m) => m.id === s.id)) await db.workout_sets.delete(s.id);
				}
				await db.workout_sets.bulkPut(mergedSets);
				this.sets = mergedSets;
			} catch (err) {
				syncDebug('strength-remote-error', {
					error: err instanceof Error ? err.message : String(err)
				});
				console.error('[strength.refresh:remote]', err);
			}
		} else {
			syncDebug('strength-remote-skip', { configured: isSupabaseConfigured, online });
		}

		this.loading = false;
		syncDebug('strength-refresh-finish', {
			exercises: this.exercises.length,
			sets: this.sets.length
		});
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

	/** Latest workout day strictly before `beforeDate`; all sets that day for this exercise, by set_number. */
	lastSessionSetsBefore(exerciseId: UUID, beforeDate: ISODate): WorkoutSet[] | null {
		const relevant = this.sets.filter(
			(s) => s.exercise_id === exerciseId && s.date < beforeDate
		);
		if (relevant.length === 0) return null;
		const first = relevant[0];
		if (!first) return null;
		let maxDate = first.date;
		for (const s of relevant) {
			if (s.date > maxDate) maxDate = s.date;
		}
		const daySets = relevant
			.filter((s) => s.date === maxDate)
			.sort((a, b) => a.set_number - b.set_number);
		return daySets.length > 0 ? daySets : null;
	}

	nextSetNumber(exerciseId: UUID, date: ISODate): number {
		const today = this.sets.filter((s) => s.exercise_id === exerciseId && s.date === date);
		return today.length === 0 ? 1 : Math.max(...today.map((s) => s.set_number)) + 1;
	}

	async createExercise(name: string, muscleGroup?: string | null): Promise<Exercise> {
		void name;
		void muscleGroup;
		throw new Error('Каталог упражнений зафиксирован в базе (22 позиции), создание отключено');
	}

	async setExerciseHidden(id: UUID, hidden: boolean): Promise<void> {
		const ex = this.exercises.find((e) => e.id === id);
		if (!ex || ex.is_preset || ex.user_id !== this.#userId) return;
		const next: Exercise = { ...ex, hidden };
		this.exercises = this.exercises.map((e) => (e.id === id ? next : e));
		await db.exercises.put(next);
		await enqueue('exercises', 'upsert', next as unknown as Record<string, unknown>);
		void drainQueue();
	}

	async deleteExercise(id: UUID): Promise<void> {
		const ex = this.exercises.find((e) => e.id === id);
		if (!ex || ex.is_preset) return;
		this.exercises = this.exercises.filter((e) => e.id !== id);
		await db.exercises.delete(id);
		await enqueue('exercises', 'delete', { id });
		void drainQueue();
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
		await enqueue('workout_sets', 'upsert', row as unknown as Record<string, unknown>);
		void drainQueue();
		return row;
	}

	async deleteSet(id: UUID): Promise<void> {
		this.sets = this.sets.filter((s) => s.id !== id);
		await db.workout_sets.delete(id);
		await enqueue('workout_sets', 'delete', { id });
		void drainQueue();
	}
}

export const strengthStore = new StrengthStore();
