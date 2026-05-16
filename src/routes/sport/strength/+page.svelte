<script lang="ts">
	import { strengthStore } from '$stores/strength.svelte';
	import { ensureSportCompleted } from '$stores/auto-complete';
	import { toasts } from '$stores/toast.svelte';
	import ExerciseDropdown from '$components/ExerciseDropdown.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import StrengthHeatmap from '$components/StrengthHeatmap.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { isSamePathname } from '$lib/nav/same-pathname';
	import { todayStore } from '$stores/today.svelte';
	import { formatRu } from '$utils/dates';
	import { uuid } from '$utils/uuid';
	import {
		MUSCLE_GROUP_LABELS,
		MUSCLE_GROUP_ORDER,
		type MuscleGroup,
		type UUID
	} from '$supabase/types';
	import {
		buildRowsFromSets,
		summaryFromSessionSets,
		type StrengthRow as Row,
		type SerializedStrengthRow as SerializedRow
	} from '$utils/strength-rows';
	import { Plus, Save, Trash2, X, Loader2, ListChecks, ChevronDown } from 'lucide-svelte';

	const DRAFT_KEY = 'strength-session-draft';
	const PERSIST_DEBOUNCE_MS = 160;

	const today = $derived(todayStore.today);

	/** Группы в селекте «+» (совпадает с порядком каталога). */
	const ADD_ROW_MUSCLE_GROUPS = MUSCLE_GROUP_ORDER;

	const TEMPLATE: Array<{ group: MuscleGroup; count: number }> = [
		{ group: 'chest', count: 2 },
		{ group: 'back', count: 2 },
		{ group: 'legs', count: 2 },
		{ group: 'arms', count: 3 }
	];
	const DEFAULT_REPS = 10;

	/** Черновики строки инпута до blur (иначе «52.» схлопывается в число). */
	let weightInputStr = $state<Record<string, string>>({});
	let setsInputStr = $state<Record<string, string>>({});

	function parseWeightInput(raw: string): number {
		const t = raw.trim().replace(',', '.');
		if (t === '' || t === '.') return 0;
		const n = parseFloat(t);
		if (!Number.isFinite(n) || n < 0) return 0;
		return n;
	}

	function parseSetsInput(raw: string): number {
		const t = raw.trim();
		if (t === '') return 0;
		const n = parseInt(t, 10);
		if (!Number.isFinite(n) || n < 0) return 0;
		return n;
	}

	function formatWeightForField(w: number): string {
		if (w === 0) return '';
		if (Number.isInteger(w)) return String(w);
		return String(w);
	}

	function weightFieldValue(row: Row): string {
		const d = weightInputStr[row.id];
		if (d !== undefined) return d;
		return formatWeightForField(row.weight);
	}

	function setsFieldValue(row: Row): string {
		const d = setsInputStr[row.id];
		if (d !== undefined) return d;
		return row.sets === 0 ? '' : String(row.sets);
	}

	function clearStrengthFieldDrafts(rowId: string) {
		const { [rowId]: _w, ...restW } = weightInputStr;
		const { [rowId]: _s, ...restS } = setsInputStr;
		weightInputStr = restW;
		setsInputStr = restS;
	}

	function makeRow(group: MuscleGroup): Row {
		return { id: uuid(), group, exerciseId: null, weight: 0, sets: 0 };
	}

	const exercisesPath = `${base}/sport/strength/exercises`;

	function openCatalog(event: MouseEvent) {
		event.preventDefault();
		if (isSamePathname($page.url.pathname, exercisesPath)) return;
		void goto(exercisesPath);
	}

	function makeTemplate(): Row[] {
		return TEMPLATE.flatMap(({ group, count }) =>
			Array.from({ length: count }, () => makeRow(group))
		);
	}

	/** Есть хотя бы одна строка, которую можно сохранить (как в saveAll). */
	function hasAnyFilledStrengthRow(list: Row[] | null): boolean {
		if (!list) return false;
		return list.some((r) => r.exerciseId && r.weight > 0 && r.sets > 0);
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
		const daySets = strengthStore.setsForDate(date);
		if (daySets.length === 0) return makeTemplate();
		return buildRowsFromSets(daySets, strengthStore.exercises);
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
	/** Не перегонять строки из черновика при каждом refresh sets[] — только смена дня / появление тренировки за день. */
	let lastStrengthHydrateKey = $state<string | null>(null);

	let addMuscleGroup = $state<MuscleGroup>('core');

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
		clearStrengthFieldDrafts(id);
		rows = rows.filter((r) => r.id !== id);
	}

	function clearRow(id: string) {
		clearStrengthFieldDrafts(id);
		rows = rows.map((r) =>
			r.id === id ? { ...r, exerciseId: null, weight: 0, sets: 0 } : r
		);
	}

	function setExercise(id: string, exerciseId: UUID) {
		clearStrengthFieldDrafts(id);
		const session = strengthStore.lastSessionSetsBefore(exerciseId, today);
		const summary = session && session.length > 0 ? summaryFromSessionSets(session) : null;
		rows = rows.map((r) => {
			if (r.id !== id) return r;
			if (summary) return { ...r, exerciseId, weight: summary.weight, sets: r.sets };
			return { ...r, exerciseId, weight: 0, sets: 0 };
		});
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
			void goto(`${base}/`, { replaceState: true });
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		const date = today;
		if (!strengthStore.loaded) return;

		const hasToday = strengthStore.setsForDate(date).length > 0;
		const hydrateKey = `${date}:${hasToday}`;
		if (hydrateKey === lastStrengthHydrateKey) return;
		lastStrengthHydrateKey = hydrateKey;

		// Если на сегодня уже есть тренировка в БД — показываем её,
		// чтобы пользователь видел сохранённый результат, а не пустую форму.
		// Пустой шаблон рисуем только когда сегодняшней тренировки ещё нет.
		if (hasToday) {
			rows = buildRowsFromDbOrTemplate(date);
		} else {
			const fromDraft = readDraft(date);
			if (!hasAnyFilledStrengthRow(fromDraft)) {
				rows = makeTemplate();
				writeDraftImmediate(date, rows);
			} else {
				rows = fromDraft ?? makeTemplate();
			}
		}
		weightInputStr = {};
		setsInputStr = {};
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
			class="grid grid-cols-[minmax(0,1fr)_72px_64px_32px_32px] items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-(--color-fg-mute)"
		>
			<span>Упражнение</span>
			<span class="text-center">Вес, кг</span>
			<span class="text-center">Подх.</span>
			<span class="sr-only">Очистить</span>
			<span class="sr-only">Удалить</span>
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
					<div class="grid grid-cols-[minmax(0,1fr)_72px_64px_32px_32px] items-center gap-2">
						<ExerciseDropdown
							exercises={strengthStore.exercises}
							value={row.exerciseId}
							onselect={(id) => setExercise(row.id, id)}
							groupFilter={group}
							compact
						/>
						<input
							type="text"
							inputmode="decimal"
							lang="en"
							value={weightFieldValue(row)}
							placeholder="0"
							disabled={!row.exerciseId}
							onfocus={() => {
								weightInputStr = {
									...weightInputStr,
									[row.id]: formatWeightForField(row.weight)
								};
							}}
							oninput={(e) => {
								const v = e.currentTarget.value;
								weightInputStr = { ...weightInputStr, [row.id]: v };
							}}
							onblur={() => {
								const raw = weightInputStr[row.id] ?? formatWeightForField(row.weight);
								const next = parseWeightInput(raw);
								rows = rows.map((r) => (r.id === row.id ? { ...r, weight: next } : r));
								const { [row.id]: _, ...rest } = weightInputStr;
								weightInputStr = rest;
							}}
							class="hairline rounded-xl bg-(--color-bg-mute) px-2 py-1 text-center text-base tabular-nums outline-none placeholder:text-(--color-fg-mute) disabled:cursor-not-allowed disabled:opacity-45"
						/>
						<input
							type="text"
							inputmode="numeric"
							value={setsFieldValue(row)}
							placeholder="0"
							disabled={!row.exerciseId}
							onfocus={() => {
								setsInputStr = {
									...setsInputStr,
									[row.id]: row.sets === 0 ? '' : String(row.sets)
								};
							}}
							oninput={(e) => {
								const v = e.currentTarget.value.replace(/\D/g, '');
								setsInputStr = { ...setsInputStr, [row.id]: v };
							}}
							onblur={() => {
								const raw = setsInputStr[row.id] ?? (row.sets === 0 ? '' : String(row.sets));
								const next = parseSetsInput(raw);
								rows = rows.map((r) => (r.id === row.id ? { ...r, sets: next } : r));
								const { [row.id]: _, ...rest } = setsInputStr;
								setsInputStr = rest;
							}}
							class="hairline rounded-xl bg-(--color-bg-mute) px-2 py-1 text-center text-base tabular-nums outline-none placeholder:text-(--color-fg-mute) disabled:cursor-not-allowed disabled:opacity-45"
						/>
						<button
							type="button"
							onclick={() => clearRow(row.id)}
							class="grid size-8 place-items-center rounded-lg text-(--color-fg-mute) hover:bg-(--color-bg-mute) hover:text-(--color-fg) disabled:opacity-30"
							aria-label="Очистить строку"
							disabled={!row.exerciseId && row.weight === 0 && row.sets === 0}
						>
							<X size={14} />
						</button>
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
				href={exercisesPath}
				onclick={openCatalog}
				class="inline-flex items-center gap-1 font-medium text-(--color-accent) hover:underline"
			>
				<ListChecks size={12} /> Каталог
			</a>
		</p>
	</section>

	<section aria-label="Активность силовых тренировок">
		<StrengthHeatmap
			sets={strengthStore.sets}
			exercises={strengthStore.exercises}
			cellSize={10}
			cellGap={2}
			sectionClass="rounded-2xl p-3 sm:rounded-3xl sm:p-4"
		/>
	</section>
</div>
