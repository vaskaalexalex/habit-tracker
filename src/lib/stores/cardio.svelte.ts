import { db } from '$db/dexie';
import { drainQueue, enqueue } from '$db/sync';
import { isSupabaseConfigured } from '$supabase/client';
import { fetchCardio } from '$supabase/api';
import type { CardioWorkout, CardioType, ISODate, UUID } from '$supabase/types';
import { uuid } from '$utils/uuid';
import { isoToday, lastNMonthsRange, toISO } from '$utils/dates';
import { mergeByKey } from '$utils/merge';
import { syncDebug } from '$utils/sync-debug';

class CardioStore {
	items = $state<CardioWorkout[]>([]);
	loading = $state<boolean>(false);
	loaded = $state<boolean>(false);

	#userId: UUID | null = null;

	setUser(userId: UUID | null): void {
		if (this.#userId === userId) return;
		this.#userId = userId;
		this.items = [];
		this.loaded = false;
	}

	#range(monthsBack: number): { fromISO: string; toISO2: string } {
		const { from, to } = lastNMonthsRange(monthsBack);
		return { fromISO: toISO(from), toISO2: toISO(to) };
	}

	async hydrateLocal(monthsBack = 6): Promise<void> {
		if (!this.#userId) return;
		const { fromISO, toISO2 } = this.#range(monthsBack);
		try {
			const local = await db.cardio_workouts
				.where('[user_id+date]')
				.between([this.#userId, fromISO], [this.#userId, toISO2], true, true)
				.toArray();
			this.items = [...local].sort((a, b) => b.date.localeCompare(a.date));
			this.loaded = true;
			syncDebug('cardio-local-loaded', { count: local.length });
		} catch (err) {
			syncDebug('cardio-local-error', {
				error: err instanceof Error ? err.message : String(err)
			});
			console.error('[cardio.hydrateLocal]', err);
			this.items = [];
			this.loaded = true;
		}
	}

	async syncRemote(monthsBack = 6): Promise<void> {
		if (!this.#userId) return;
		const { fromISO, toISO2 } = this.#range(monthsBack);
		const local = [...this.items];

		const online = typeof navigator === 'undefined' || navigator.onLine !== false;
		if (isSupabaseConfigured && online) {
			try {
				await drainQueue();
				const remote = await fetchCardio(this.#userId, fromISO, toISO2);
				syncDebug('cardio-remote-loaded', { count: remote.length });
				await db.cardio_workouts.bulkPut(remote);
				this.items = mergeByKey(local, remote, (item) => item.id).sort((a, b) =>
					b.date.localeCompare(a.date)
				);
			} catch (err) {
				syncDebug('cardio-remote-error', {
					error: err instanceof Error ? err.message : String(err)
				});
				console.error('[cardio.syncRemote]', err);
			}
		} else {
			syncDebug('cardio-remote-skip', { configured: isSupabaseConfigured, online });
		}
	}

	async refresh(monthsBack = 6): Promise<void> {
		if (!this.#userId) return;
		this.loading = true;
		const { fromISO, toISO2 } = this.#range(monthsBack);
		syncDebug('cardio-refresh-start', { userId: this.#userId, from: fromISO, to: toISO2 });
		await this.hydrateLocal(monthsBack);
		await this.syncRemote(monthsBack);
		this.loading = false;
		syncDebug('cardio-refresh-finish', { count: this.items.length });
	}

	async add(input: {
		type: CardioType;
		duration_min: number;
		distance_km?: number | null;
		note?: string | null;
		date?: ISODate;
	}): Promise<CardioWorkout> {
		if (!this.#userId) throw new Error('not authenticated');
		const row: CardioWorkout = {
			id: uuid(),
			user_id: this.#userId,
			date: input.date ?? isoToday(),
			type: input.type,
			duration_min: input.duration_min,
			distance_km: input.distance_km ?? null,
			note: input.note ?? null,
			created_at: new Date().toISOString()
		};
		this.items = [row, ...this.items];
		await db.cardio_workouts.put(row);
		await enqueue('cardio_workouts', 'upsert', row as unknown as Record<string, unknown>);
		void drainQueue();
		return row;
	}

	async remove(id: UUID): Promise<void> {
		this.items = this.items.filter((c) => c.id !== id);
		await db.cardio_workouts.delete(id);
		await enqueue('cardio_workouts', 'delete', { id });
		void drainQueue();
	}
}

export const cardioStore = new CardioStore();
