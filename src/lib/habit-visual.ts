import { Dumbbell, Code2, BookOpen, Pencil } from 'lucide-svelte';
import type { HabitType } from '$supabase/types';

export const habitIcon = {
	sport: Dumbbell,
	coding: Code2,
	reading: BookOpen,
	journal: Pencil
} as const;

export function habitColorVar(habit: HabitType): string {
	switch (habit) {
		case 'sport':
			return 'var(--color-sport)';
		case 'coding':
			return 'var(--color-coding)';
		case 'reading':
			return 'var(--color-reading)';
		case 'journal':
			return 'var(--color-journal)';
		default:
			return 'var(--color-accent)';
	}
}
