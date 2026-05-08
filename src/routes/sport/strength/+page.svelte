<script lang="ts">
	import { strengthStore } from '$stores/strength.svelte';
	import { ensureSportCompleted } from '$stores/auto-complete';
	import { toasts } from '$stores/toast.svelte';
	import ExerciseDropdown from '$components/ExerciseDropdown.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { todayStore } from '$stores/today.svelte';
	import { formatRu } from '$utils/dates';
	import { uuid } from '$utils/uuid';
	import {
		MUSCLE_GROUP_LABELS,
		MUSCLE_GROUP_ORDER,
		type MuscleGroup,
		type UUID,
		type WorkoutSet
	} from '$supabase/types';
	import { Plus, Save, Trash2, Loader2, ListChecks, ChevronDown } from 'lucide-svelte';

	const DRAFT_KEY = 'strength-session-draft';
	const PERSIST_DEBOUNCE_MS = 160;

	const today = $derived(todayStore.today);

	type Row = {
		id: string;
		group: MuscleGroup;
		exerciseId: UUID | null;
		weight: number;
		sets: number;
	};

	type SerializedRow = Pick<Row, 'id' | 'group' | 'exerciseId' | 'weight' | 'sets'>;

	/** Группы в селекте «+» (совпадает с порядком каталога). */
	const ADD_ROW_MUSCLE_GROUPS = MUSCLE_GROUP_ORDER;

	const TEMPLATE: Array<{ group: MuscleGroup; count: number }> = [
		{ group: 'chest', count: 2 },
		{ group: 'back', count: 2 },
		{ group: 'legs', count: 2 },
		{ group: 'arms', count: 3 },
		{ group: 'core', count: 2 }
	];
	const DEFAULT_REPS = 10;

	function normalizeMuscle(raw: string | null): MuscleGroup {
		if (raw === 'shoulders') return 'arms';
		if (raw === 'other') return 'arms';
		const r = (raw ?? '').trim().toLowerCase();
		if ((MUSCLE_GROUP_ORDER as readonly string[]).includes(r)) return r as MuscleGroup;
		return 'arms';
	}

	function makeRow(group: MuscleGroup): Row {
		return { id: uuid(), group, exerciseId: null, weight: 0, sets: 0 };
	}

	function openCatalog(event: MouseEvent) {
		event.preventDefault();
		void goto(`${base}/sport/strength/exercises`);
	}

	function makeTemplate(): Row[] {
		return TEMPLATE.flatMap(({ group, count }) =>
			Array.from({ length: count }, () => makeRow(group))
		);
	}

	function isValidSerializedRow(x: unknown): x is SerializedRow {
		if (typeof x !== 'object' || x === null) return false;
		const o = x as Record<string, unknown>;
		return (
			typeof o.id === 'string' &&
			typeof o.group === 'string' &&
			(MUSCLE_GROUP_ORDER as readonly string[]).includes(o.group) &&
			(o.exerciseId === null || typeof o.exerciseId === 'string') &&
			typeof o.weight === 'number' &&
			typeof o.sets === 'number'
		);
	}

	function buildRowsFromDbOrTemplate(date: string): Row[] {
		const sets = strengthStore.setsForDate(date);
		if (sets.length === 0) return makeTemplate();

		const byEx = new Map<UUID, WorkoutSet[]>();
		for (const s of sets) {
			const arr = byEx.get(s.exercise_id) ?? [];
			arr.push(s);
			byEx.set(s.exercise_id, arr);
		}

		const result: Row[] = [];
		for (const [exerciseId, list] of byEx) {
			const sorted = [...list].sort((a, b) => a.set_number - b.set_number);
			const last = sorted.at(-1);
			if (!last) continue;
			const ex = strengthStore.exercises.find((e) => e.id === exerciseId);
			const group = normalizeMuscle(ex?.muscle_group ?? null);
			result.push({
				id: uuid(),
				group,
				exerciseId,
				weight: last.weight,
				sets: sorted.length
			});
		}

		result.sort((a, b) => {
			const ai = MUSCLE_GROUP_ORDER.indexOf(a.group);
			const bi = MUSCLE_GROUP_ORDER.indexOf(b.group);
			if (ai !== bi) return ai - bi;
			const na = strengthStore.exercises.find((e) => e.id === a.exerciseId)?.name ?? '';
			const nb = strengthStore.exercises.find((e) => e.id === b.exerciseId)?.name ?? '';
			return na.localeCompare(nb, 'ru');
		});
		return result;
	}

	function readDraft(date: string): Row[] | null {
		if (typeof localStorage === 'undefined') return null;
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as { date?: string; rows?: unknown };
			if (parsed.date !== date || !Array.isArray(parsed.rows) || parsed.rows.length === 0) {
				return null;
			}
			const rows: Row[] = [];
			for (const item of parsed.rows) {
				if (!isValidSerializedRow(item)) return null;
				rows.push({
					id: item.id,
					group: item.group,
					exerciseId: item.exerciseId,
					weight: item.weight,
					sets: item.sets
				});
			}
			return rows;
		} catch {
			return null;
		}
	}

	function writeDraftImmediate(date: string, nextRows: Row[]) {
		if (typeof localStorage === 'undefined') return;
		const payload: { date: string; rows: SerializedRow[] } = {
			date,
			rows: nextRows.map((r) => ({
				id: r.id,
				group: r.group,
				exerciseId: r.exerciseId,
				weight: r.weight,
				sets: r.sets
			}))
		};
		localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
	}

	let rows = $state<Row[]>(makeTemplate());
	let saving = $state(false);
	let sessionReady = $state(false);
	let persistTimer: ReturnType<typeof setTimeout> | null = null;

	let addMuscleGroup = $state<MuscleGroup>('chest');

	const filledCount = $derived(
		rows.filter((r) => r.exerciseId && r.weight > 0 && r.sets > 0).length
	);

	// Нормализованный снапшот значимых строк: только заполненные, отсортированные.
	// Нужен для сравнения "что в форме" vs "что уже в БД на сегодня",
	// чтобы прятать кнопку Сохранить, когда изменений нет.
	function snapshotKey(list: Row[]): string {
		const filled = list
			.filter((r) => r.exerciseId && r.weight > 0 && r.sets > 0)
			.map((r) => ({ ex: r.exerciseId as string, w: r.weight, s: r.sets }));
		filled.sort((a, b) => {
			if (a.ex !== b.ex) return a.ex < b.ex ? -1 : 1;
			if (a.w !== b.w) return a.w - b.w;
			return a.s - b.s;
		});
		return JSON.stringify(filled);
	}

	const savedKey = $derived(snapshotKey(buildRowsFromDbOrTemplate(today)));
	const currentKey = $derived(snapshotKey(rows));
	const hasChanges = $derived(sessionReady && savedKey !== currentKey);

	const groupsInOrder = $derived(
		MUSCLE_GROUP_ORDER.filter((g) => rows.some((r) => r.group === g))
	);

	function rowsByGroup(group: MuscleGroup): Row[] {
		return rows.filter((r) => r.group === group);
	}

	function addRow(group: MuscleGroup) {
		const idx = rows.findLastIndex((r) => r.group === group);
		const insertAt = idx === -1 ? rows.length : idx + 1;
		rows = [...rows.slice(0, insertAt), makeRow(group), ...rows.slice(insertAt)];
	}

	function removeRow(id: string) {
		rows = rows.filter((r) => r.id !== id);
	}

	function setExercise(id: string, exerciseId: UUID) {
		rows = rows.map((r) => (r.id === id ? { ...r, exerciseId } : r));
	}

	function lastHint(row: Row): string | null {
		if (!row.exerciseId) return null;
		const session = strengthStore.lastSessionSetsBefore(row.exerciseId, today);
		if (!session || session.length === 0) return null;
		const head = session[0];
		if (!head) return null;
		const d = head.date;
		const parts = session.map((s) => `${s.weight}×${s.reps}`);
		return `Прошлый раз — ${formatRu(d)}: ${parts.join(', ')}`;
	}

	async function saveAll() {
		if (saving) return;
		const valid = rows.filter((r) => r.exerciseId && r.weight > 0 && r.sets > 0);
		if (valid.length === 0) {
			toasts.error('Заполни хотя бы одну строку');
			return;
		}
		saving = true;
		try {
			for (const row of valid) {
				for (let i = 0; i < row.sets; i++) {
					await strengthStore.addSet({
						exercise_id: row.exerciseId as UUID,
						weight: row.weight,
						reps: DEFAULT_REPS
					});
				}
			}
			await ensureSportCompleted();
			toasts.success(`Сохранено ${valid.length} упражнен${valid.length === 1 ? 'ие' : 'ий'}`);
			// Сразу показываем только что сохранённую тренировку, чтобы юзер
			// мог её посмотреть/доредактировать вместо пустого шаблона.
			rows = buildRowsFromDbOrTemplate(today);
			writeDraftImmediate(today, rows);
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		const date = today;
		if (!strengthStore.loaded) return;

		// Если на сегодня уже есть тренировка в БД — показываем её,
		// чтобы пользователь видел сохранённый результат, а не пустую форму.
		// Пустой шаблон рисуем только когда сегодняшней тренировки ещё нет.
		const hasToday = strengthStore.setsForDate(date).length > 0;
		if (hasToday) {
			rows = buildRowsFromDbOrTemplate(date);
		} else {
			const fromDraft = readDraft(date);
			rows = fromDraft ?? makeTemplate();
		}
		sessionReady = true;
	});

	$effect(() => {
		if (!sessionReady) return;
		const date = today;
		const snapshot = rows;
		if (persistTimer) clearTimeout(persistTimer);
		persistTimer = setTimeout(() => {
			writeDraftImmediate(date, snapshot);
			persistTimer = null;
		}, PERSIST_DEBOUNCE_MS);
		return () => {
			if (persistTimer) {
				clearTimeout(persistTimer);
				persistTimer = null;
			}
		};
	});
</script>

<div class="page-shell">
	<PageHeader
		backFallback="/sport"
		kicker="Сессия"
		title="Силовая"
		subtitle={formatRu(today)}
		showTrailing={hasChanges}
	>
		{#snippet trailing()}
			<button
				type="button"
				onclick={saveAll}
				disabled={saving || filledCount === 0}
				class="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-(--color-accent) px-3 text-sm font-bold text-white transition active:scale-[0.97] disabled:opacity-50"
			>
				{#if saving}
					<Loader2 size={16} class="animate-spin" />
				{:else}
					<Save size={16} />
				{/if}
				<span>Сохранить{filledCount > 0 ? ` · ${filledCount}` : ''}</span>
			</button>
		{/snippet}
	</PageHeader>

	<section class="hairline flex flex-col gap-3 rounded-3xl bg-(--color-bg-soft) p-3">
		<div
			class="grid grid-cols-[minmax(0,1fr)_72px_64px_32px] items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-(--color-fg-mute)"
		>
			<span>Упражнение</span>
			<span class="text-center">Вес, кг</span>
			<span class="text-center">Подх.</span>
			<span></span>
		</div>

		{#each groupsInOrder as group (group)}
			<div class="flex flex-col gap-1.5">
				<div class="flex items-center gap-2 px-1">
					<span
						class="inline-flex items-center rounded-full bg-(--color-bg-mute) px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-(--color-fg)"
					>
						{MUSCLE_GROUP_LABELS[group]}
					</span>
					<span class="h-px flex-1 bg-(--color-border)"></span>
				</div>

				{#each rowsByGroup(group) as row (row.id)}
					<div class="flex flex-col gap-1">
						{#if lastHint(row)}
							<p class="px-1 text-[10px] leading-snug text-(--color-fg-mute)">{lastHint(row)}</p>
						{/if}
						<div class="grid grid-cols-[minmax(0,1fr)_72px_64px_32px] items-center gap-2">
							<ExerciseDropdown
								exercises={strengthStore.exercises}
								value={row.exerciseId}
								onselect={(id) => setExercise(row.id, id)}
								groupFilter={group}
								compact
							/>
							<input
								type="number"
								inputmode="decimal"
								min="0"
								step="0.5"
								bind:value={row.weight}
								placeholder="0"
								class="hairline rounded-xl bg-(--color-bg-mute) px-2 py-1 text-center text-base tabular-nums outline-none placeholder:text-(--color-fg-mute)"
							/>
							<input
								type="number"
								inputmode="numeric"
								min="0"
								step="1"
								bind:value={row.sets}
								placeholder="0"
								class="hairline rounded-xl bg-(--color-bg-mute) px-2 py-1 text-center text-base tabular-nums outline-none placeholder:text-(--color-fg-mute)"
							/>
							<button
								type="button"
								onclick={() => removeRow(row.id)}
								class="grid size-8 place-items-center rounded-lg text-(--color-fg-mute) hover:bg-(--color-bg-mute) hover:text-rose-400 disabled:opacity-30"
								aria-label="Удалить строку"
								disabled={rows.length <= 1}
							>
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/each}

		<div class="flex flex-col gap-2 border-t border-(--color-border) pt-3">
			<div class="flex flex-wrap items-center gap-2 px-1">
				<label class="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-medium text-(--color-fg-mute)">
					<span class="shrink-0">Группа</span>
					<div class="relative min-w-0 flex-1">
						<select
							bind:value={addMuscleGroup}
							class="hairline w-full cursor-pointer appearance-none rounded-xl bg-(--color-bg-mute) py-1.5 pl-3 pr-10 text-sm outline-none"
						>
							{#each ADD_ROW_MUSCLE_GROUPS as g (g)}
								<option value={g}>{MUSCLE_GROUP_LABELS[g]}</option>
							{/each}
						</select>
						<ChevronDown
							size={16}
							class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-(--color-fg-mute)"
							aria-hidden="true"
						/>
					</div>
				</label>
				<button
					type="button"
					onclick={() => addRow(addMuscleGroup)}
					class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--color-border) px-3 py-2 text-xs font-semibold text-(--color-fg-mute) hover:bg-(--color-bg-mute) hover:text-(--color-fg) disabled:pointer-events-none disabled:opacity-40"
				>
					<Plus size={14} /> Добавить упражнение
				</button>
			</div>
		</div>

		<p class="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 pt-1 text-[11px] text-(--color-fg-mute)">
			<span>Подход = {DEFAULT_REPS} повторений по умолчанию. Список из каталога — </span>
			<a
				href={`${base}/sport/strength/exercises`}
				onclick={openCatalog}
				class="inline-flex items-center gap-1 font-medium text-(--color-accent) hover:underline"
			>
				<ListChecks size={12} /> Каталог
			</a>
		</p>
	</section>
</div>
