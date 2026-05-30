import { isoToday, shiftDays, formatRu } from '$utils/dates';
import type { ISODate, TaskStatus } from '$supabase/types';

export type DeadlineState = 'none' | 'soon' | 'overdue';

/**
 * Whether a task's deadline needs the red clock highlight.
 * - `overdue`: past due and not done.
 * - `soon`: due today or tomorrow and not done.
 */
export function deadlineState(
	due: ISODate | null,
	status: TaskStatus,
	today: ISODate = isoToday()
): DeadlineState {
	if (!due || status === 'done') return 'none';
	if (due < today) return 'overdue';
	if (due === today || due === shiftDays(today, 1)) return 'soon';
	return 'none';
}

export function deadlineLabel(due: ISODate, today: ISODate = isoToday()): string {
	if (due === today) return 'Сегодня';
	if (due === shiftDays(today, 1)) return 'Завтра';
	if (due === shiftDays(today, -1)) return 'Вчера';
	return formatRu(due, 'd MMM');
}
