import { db } from '$db/dexie';
import { drainQueue, enqueue, hasPendingSync } from '$db/sync';
import { isSupabaseConfigured } from '$supabase/client';
import { deleteCardio as apiDelete, fetchCardio, insertCardio } from '$supabase/api';
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
		if (userId) void this.refresh();
	}

	async refresh(monthsBack = 6): Promise<void> {
		if (!this.#userId) return;
		this.loading = true;
		const { from, to } = lastNMonthsRange(monthsBack);
		const fromISO = toISO(from);
		const toISO2 = toISO(to);
		syncDebug('cardio-refresh-start', { userId: this.#userId, from: fromISO, to: toISO2 });
		try {
			const local = await db.cardio_workouts
				.where('[user_id+date]')
				.between([this.#userId, fromISO], [this.#userId, toISO2], true, true)
				.toArray();
			this.items = local.sort((a, b) => b.date.localeCompare(a.date));
			syncDebug('cardio-local-loaded', { count: local.length });

			if (isSupabaseConfigured) {
				await drainQueue();
				const remote = await fetchCardio(this.#userId, fromISO, toISO2);
				syncDebug('cardio-remote-loaded', { count: remote.length });
				await db.cardio_workouts.bulkPut(remote);
				this.items = (
					(await hasPendingSync('cardio_workouts'))
						? mergeByKey(local, remote, (item) => item.id)
						: remote
				).sort((a, b) => b.date.localeCompare(a.date));
			}
			this.loaded = true;
			syncDebug('cardio-refresh-finish', { count: this.items.length });
		} catch (err) {
			syncDebug('cardio-refresh-error', {
				error: err instanceof Error ? err.message : String(err)
			});
			console.error('[cardio.refresh]', err);
		} finally {
			this.loading = false;
		}
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
		if (isSupabaseConfigured) {
			try {
				await insertCardio(row);
			} catch (err) {
				console.error('[cardio.add]', err);
				await enqueue('cardio_workouts', 'upsert', row as unknown as Record<string, unknown>);
			}
		} else {
			await enqueue('cardio_workouts', 'upsert', row as unknown as Record<string, unknown>);
		}
		void drainQueue();
		return row;
	}

	async remove(id: UUID): Promise<void> {
		this.items = this.items.filter((c) => c.id !== id);
		await db.cardio_workouts.delete(id);
		if (isSupabaseConfigured) {
			try {
				await apiDelete(id);
			} catch (err) {
				console.error('[cardio.remove]', err);
				await enqueue('cardio_workouts', 'delete', { id });
			}
		} else {
			await enqueue('cardio_workouts', 'delete', { id });
		}
	}
}

export const cardioStore = new CardioStore();
