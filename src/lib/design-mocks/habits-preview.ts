import { eachDayOfInterval, parseISO, subMonths } from 'date-fns';
import type { HabitCompletion, HabitType, ISODate } from '$supabase/types';
import { HABIT_ORDER } from '$supabase/types';
import { toISO } from '$utils/dates';

/** Стабильная «сегодня» для превью (среда 6 мая 2026). */
export const MOCK_TODAY: ISODate = '2026-05-06';

export const MOCK_PREVIEW_USER_ID = '00000000-0000-4000-8000-000000000001';

/** Сегодня отмечены спорт и кодинг — 2/4 для кольца и карточек. */
export const mockCompletedToday: ReadonlySet<HabitType> = new Set(['sport', 'coding']);

export const mockStreaks: Record<HabitType, number> = {
	sport: 14,
	coding: 7,
	reading: 3,
	journal: 1
};

let idSeq = 0;

function nextMockId(): string {
	idSeq += 1;
	const hex = idSeq.toString(16).padStart(12, '0');
	return `00000000-0000-4000-8000-${hex}`;
}

function buildCompletions(): HabitCompletion[] {
	const end = parseISO(MOCK_TODAY);
	const start = subMonths(end, 6);
	const days = eachDayOfInterval({ start, end });
	const list: HabitCompletion[] = [];

	for (const day of days) {
		const iso = toISO(day);
		const dow = day.getDay();
		const weekend = dow === 0 || dow === 6;
		const seed = day.getDate() + day.getMonth() * 31 + day.getFullYear();
		let count = (seed % 5) % (weekend ? 3 : 4);
		if (!weekend && count === 0) count = 1;

		const picked = new Set<HabitType>();
		let i = 0;
		while (picked.size < count && i < 12) {
			const habit = HABIT_ORDER[(seed + i) % 4]!;
			picked.add(habit);
			i += 1;
		}

		for (const habit of picked) {
			list.push({
				id: nextMockId(),
				user_id: MOCK_PREVIEW_USER_ID,
				habit_type: habit,
				date: iso,
				created_at: `${iso}T08:00:00.000Z`
			});
		}
	}

	const withoutToday = list.filter((c) => c.date !== MOCK_TODAY);
	const todayHabits = mockCompletedToday;
	for (const habit of todayHabits) {
		withoutToday.push({
			id: nextMockId(),
			user_id: MOCK_PREVIEW_USER_ID,
			habit_type: habit,
			date: MOCK_TODAY,
			created_at: `${MOCK_TODAY}T12:00:00.000Z`
		});
	}

	return withoutToday;
}

/** Готовый список для `HabitHeatmap` (~6 мес активности). */
export const mockHabitCompletions: HabitCompletion[] = buildCompletions();

export const mockProfileName = 'Алексей';
