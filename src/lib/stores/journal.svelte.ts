import { db } from '$db/dexie';
import { drainQueue, enqueue, hasPendingSync } from '$db/sync';
import { isSupabaseConfigured } from '$supabase/client';
import { fetchJournal, fetchJournalDay, upsertJournal } from '$supabase/api';
import type { ISODate, JournalEntry, UUID } from '$supabase/types';
import { uuid } from '$utils/uuid';
import { isoToday, lastNMonthsRange, toISO } from '$utils/dates';
import { mergeByKey } from '$utils/merge';

class JournalStore {
	entries = $state<JournalEntry[]>([]);
	loading = $state<boolean>(false);
	loaded = $state<boolean>(false);

	#userId: UUID | null = null;

	setUser(userId: UUID | null): void {
		if (this.#userId === userId) return;
		this.#userId = userId;
		this.entries = [];
		this.loaded = false;
		if (userId) void this.refresh();
	}

	async refresh(monthsBack = 12): Promise<void> {
		if (!this.#userId) return;
		this.loading = true;
		const { from, to } = lastNMonthsRange(monthsBack);
		const fromISO = toISO(from);
		const toISO2 = toISO(to);
		try {
			const local = await db.journal_entries
				.where('[user_id+date]')
				.between([this.#userId, fromISO], [this.#userId, toISO2], true, true)
				.toArray();
			this.entries = local.sort((a, b) => b.date.localeCompare(a.date));

			if (isSupabaseConfigured) {
				await drainQueue();
				const remote = await fetchJournal(this.#userId, fromISO, toISO2);
				await db.journal_entries.bulkPut(remote);
				this.entries = ((await hasPendingSync('journal_entries'))
					? mergeByKey(
							local,
							remote,
							(item) => `${item.user_id}:${item.date}`,
							(localItem, remoteItem) =>
								localItem.updated_at > remoteItem.updated_at ? localItem : remoteItem
						)
					: remote
				).sort((a, b) => b.date.localeCompare(a.date));
			}
			this.loaded = true;
		} catch (err) {
			console.error('[journal.refresh]', err);
		} finally {
			this.loading = false;
		}
	}

	getByDate(date: ISODate): JournalEntry | undefined {
		return this.entries.find((e) => e.date === date);
	}

	async loadDay(date: ISODate): Promise<JournalEntry | null> {
		if (!this.#userId) return null;
		const local = this.getByDate(date);
		if (local) return local;
		const cached = await db.journal_entries
			.where('[user_id+date]')
			.equals([this.#userId, date])
			.first();
		if (cached) {
			this.entries = [cached, ...this.entries.filter((e) => e.date !== date)];
			return cached;
		}
		if (!isSupabaseConfigured) return null;
		const remote = await fetchJournalDay(this.#userId, date);
		if (remote) {
			await db.journal_entries.put(remote);
			this.entries = [remote, ...this.entries.filter((e) => e.date !== date)];
		}
		return remote;
	}

	async upsertDay(input: {
		date: ISODate;
		content: string;
		mood: number | null;
	}): Promise<JournalEntry> {
		if (!this.#userId) throw new Error('not authenticated');
		const existing = this.getByDate(input.date);
		const now = new Date().toISOString();
		const row: JournalEntry = existing
			? { ...existing, content: input.content, mood: input.mood, updated_at: now }
			: {
					id: uuid(),
					user_id: this.#userId,
					date: input.date,
					content: input.content,
					mood: input.mood,
					created_at: now,
					updated_at: now
				};
		this.entries = [row, ...this.entries.filter((e) => e.date !== input.date)];
		await db.journal_entries.put(row);
		if (isSupabaseConfigured) {
			try {
				await upsertJournal(row);
			} catch (err) {
				console.error('[journal.upsertDay]', err);
				await enqueue('journal_entries', 'upsert', row as unknown as Record<string, unknown>);
			}
		} else {
			await enqueue('journal_entries', 'upsert', row as unknown as Record<string, unknown>);
		}
		void drainQueue();
		return row;
	}

	todayDraft(): JournalEntry | null {
		return this.getByDate(isoToday()) ?? null;
	}
}

export const journalStore = new JournalStore();
