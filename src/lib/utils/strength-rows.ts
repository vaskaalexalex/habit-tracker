import type { Exercise, MuscleGroup, UUID, WorkoutSet } from '$supabase/types';
import { MUSCLE_GROUP_ORDER } from '$supabase/types';
import { uuid } from '$utils/uuid';

export type StrengthRow = {
	id: string;
	group: MuscleGroup;
	exerciseId: UUID | null;
	weight: number;
	sets: number;
};

export type SerializedStrengthRow = Pick<
	StrengthRow,
	'id' | 'group' | 'exerciseId' | 'weight' | 'sets'
>;

export function normalizeMuscle(raw: string | null): MuscleGroup {
	if (raw === 'shoulders') return 'arms';
	if (raw === 'other') return 'arms';
	const r = (raw ?? '').trim().toLowerCase();
	if ((MUSCLE_GROUP_ORDER as readonly string[]).includes(r)) return r as MuscleGroup;
	return 'arms';
}

/** Last set's weight + total set count for one exercise's session day. */
export function summaryFromSessionSets(
	list: WorkoutSet[]
): { weight: number; sets: number } | null {
	const sorted = [...list].sort((a, b) => a.set_number - b.set_number);
	const last = sorted.at(-1);
	if (!last) return null;
	return { weight: last.weight, sets: sorted.length };
}

/** Aggregate raw `WorkoutSet[]` of one date into UI rows grouped/sorted by muscle group. Empty if no sets. */
export function buildRowsFromSets(sets: WorkoutSet[], exercises: Exercise[]): StrengthRow[] {
	if (sets.length === 0) return [];

	const byEx = new Map<UUID, WorkoutSet[]>();
	for (const s of sets) {
		const arr = byEx.get(s.exercise_id) ?? [];
		arr.push(s);
		byEx.set(s.exercise_id, arr);
	}

	const result: StrengthRow[] = [];
	for (const [exerciseId, list] of byEx) {
		const summary = summaryFromSessionSets(list);
		if (!summary) continue;
		const ex = exercises.find((e) => e.id === exerciseId);
		const group = normalizeMuscle(ex?.muscle_group ?? null);
		result.push({
			id: uuid(),
			group,
			exerciseId,
			weight: summary.weight,
			sets: summary.sets
		});
	}

	result.sort((a, b) => {
		const ai = MUSCLE_GROUP_ORDER.indexOf(a.group);
		const bi = MUSCLE_GROUP_ORDER.indexOf(b.group);
		if (ai !== bi) return ai - bi;
		const na = exercises.find((e) => e.id === a.exerciseId)?.name ?? '';
		const nb = exercises.find((e) => e.id === b.exerciseId)?.name ?? '';
		return na.localeCompare(nb, 'ru');
	});
	return result;
}
