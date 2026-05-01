import { db } from '$db/dexie';
import { drainQueue, enqueue, hasPendingSync } from '$db/sync';
import { isSupabaseConfigured } from '$supabase/client';
import { fetchHabitCompletionsRange } from '$supabase/api';
import type { HabitCompletion, HabitType, ISODate, UUID } from '$supabase/types';
import { uuid } from '$utils/uuid';
import { isoToday, lastNMonthsRange, toISO } from '$utils/dates';
import { mergeByKey } from '$utils/merge';

class HabitsStore {
	completions = $state<HabitCompletion[]>([]);
	loading = $state<boolean>(false);
	loaded = $state<boolean>(false);

	#userId: UUID | null = null;

	setUser(userId: UUID | null): void {
		if (this.#userId === userId) return;
		this.#userId = userId;
		this.completions = [];
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
			const local = await db.habit_completions
				.where('[user_id+date]')
				.between([this.#userId, fromISO], [this.#userId, toISO2], true, true)
				.toArray();
			this.completions = local;

			if (isSupabaseConfigured) {
				await drainQueue();
				const remote = await fetchHabitCompletionsRange(this.#userId, fromISO, toISO2);
				await db.habit_completions.bulkPut(remote);
				this.completions = (await hasPendingSync('habit_completions'))
					? mergeByKey(
							local,
							remote,
							(item) => `${item.user_id}:${item.habit_type}:${item.date}`
						)
					: remote;
			}
			this.loaded = true;
		} catch (err) {
			console.error('[habits.refresh]', err);
		} finally {
			this.loading = false;
		}
	}

	isCompleted(habit: HabitType, date: ISODate): boolean {
		return this.completions.some((c) => c.habit_type === habit && c.date === date);
	}

	completionsByHabit(habit: HabitType): HabitCompletion[] {
		return this.completions.filter((c) => c.habit_type === habit);
	}

	streak(habit: HabitType, today: ISODate = isoToday()): number {
		const dates = new Set(this.completionsByHabit(habit).map((c) => c.date));
		let streak = 0;
		const start = new Date(today);
		for (let i = 0; i < 365; i++) {
			const d = new Date(start);
			d.setDate(start.getDate() - i);
			if (dates.has(toISO(d))) streak++;
			else if (i === 0) {
				continue;
			} else break;
		}
		return streak;
	}

	completionsByMonth(habit: HabitType): Map<string, number> {
		const map = new Map<string, number>();
		for (const c of this.completionsByHabit(habit)) {
			const key = c.date.slice(0, 7);
			map.set(key, (map.get(key) ?? 0) + 1);
		}
		return map;
	}

	async toggle(habit: HabitType, date: ISODate = isoToday()): Promise<void> {
		if (!this.#userId) return;
		const existing = this.completions.find((c) => c.habit_type === habit && c.date === date);
		if (existing) {
			this.completions = this.completions.filter((c) => c.id !== existing.id);
			await db.habit_completions.delete(existing.id);
			await enqueue('habit_completions', 'delete', {
				id: existing.id,
				user_id: existing.user_id,
				habit_type: existing.habit_type,
				date: existing.date
			});
			void drainQueue();
			return;
		}
		await this.markDone(habit, date);
	}

	async markDone(habit: HabitType, date: ISODate = isoToday()): Promise<void> {
		if (!this.#userId) return;
		if (this.isCompleted(habit, date)) return;
		const row: HabitCompletion = {
			id: uuid(),
			user_id: this.#userId,
			habit_type: habit,
			date,
			created_at: new Date().toISOString()
		};
		this.completions = [...this.completions, row];
		await db.habit_completions.put(row);
		await enqueue('habit_completions', 'upsert', row as unknown as Record<string, unknown>);
		void drainQueue();
	}

	async markUndone(habit: HabitType, date: ISODate = isoToday()): Promise<void> {
		if (!this.#userId) return;
		const existing = this.completions.find((c) => c.habit_type === habit && c.date === date);
		if (!existing) return;
		this.completions = this.completions.filter((c) => c.id !== existing.id);
		await db.habit_completions.delete(existing.id);
		await enqueue('habit_completions', 'delete', {
			id: existing.id,
			user_id: existing.user_id,
			habit_type: existing.habit_type,
			date: existing.date
		});
		void drainQueue();
	}
}

export const habitsStore = new HabitsStore();
