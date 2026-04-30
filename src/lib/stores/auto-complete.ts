import type { ISODate } from '$supabase/types';
import { habitsStore } from './habits.svelte';
import { strengthStore } from './strength.svelte';
import { cardioStore } from './cardio.svelte';
import { isoToday } from '$utils/dates';

export async function ensureSportCompleted(date: ISODate = isoToday()): Promise<void> {
	if (!habitsStore.isCompleted('sport', date)) {
		await habitsStore.markDone('sport', date);
	}
}

export async function ensureSportNotCompletedIfEmpty(
	date: ISODate = isoToday()
): Promise<void> {
	const hasStrength = strengthStore.setsForDate(date).length > 0;
	const hasCardio = cardioStore.items.some((c) => c.date === date);
	if (hasStrength || hasCardio) return;
	if (habitsStore.isCompleted('sport', date)) {
		await habitsStore.markUndone('sport', date);
	}
}

export async function reconcileSportCompletions(): Promise<void> {
	const dates = habitsStore.completionsByHabit('sport').map((c) => c.date);
	for (const date of dates) {
		const hasStrength = strengthStore.setsForDate(date).length > 0;
		const hasCardio = cardioStore.items.some((c) => c.date === date);
		if (!hasStrength && !hasCardio) {
			await habitsStore.markUndone('sport', date);
		}
	}
}

export async function ensureJournalCompleted(date: ISODate = isoToday()): Promise<void> {
	if (!habitsStore.isCompleted('journal', date)) {
		await habitsStore.markDone('journal', date);
	}
}
