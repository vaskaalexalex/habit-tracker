import type { HabitCompletion, HabitType } from '$supabase/types';

/** Общие пропсы для композиций превью (моки). */
export interface DesignPreviewMocks {
	completions: HabitCompletion[];
	completedToday: ReadonlySet<HabitType>;
	streaks: Record<HabitType, number>;
	todayLabel: string;
	profileName: string;
}
