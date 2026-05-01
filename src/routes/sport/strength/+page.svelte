<script lang="ts">
	import { strengthStore } from '$stores/strength.svelte';
	import { ensureSportCompleted } from '$stores/auto-complete';
	import { toasts } from '$stores/toast.svelte';
	import ExerciseDropdown from '$components/ExerciseDropdown.svelte';
	import WorkoutLog from '$components/WorkoutLog.svelte';
	import ProgressChart from '$components/ProgressChart.svelte';
	import BackButton from '$components/BackButton.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { todayStore } from '$stores/today.svelte';
	import { formatRu } from '$utils/dates';
	import { uuid } from '$utils/uuid';
	import { MUSCLE_GROUP_LABELS, type MuscleGroup, type UUID } from '$supabase/types';
	import { Plus, Save, Trash2, Loader2, ListChecks } from 'lucide-svelte';

	const today = $derived(todayStore.today);

	type Row = {
		id: string;
		group: MuscleGroup;
		exerciseId: UUID | null;
		weight: number;
		sets: number;
	};

	const TEMPLATE: Array<{ group: MuscleGroup; count: number }> = [
		{ group: 'chest', count: 2 },
		{ group: 'back', count: 2 },
		{ group: 'legs', count: 2 },
		{ group: 'arms', count: 3 }
	];
	const SECTION_GROUPS: MuscleGroup[] = ['chest', 'back', 'legs', 'arms'];
	const DEFAULT_REPS = 10;

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

	let rows = $state<Row[]>(makeTemplate());
	let saving = $state(false);
	let progressExId = $state<UUID | null>(null);

	const filledCount = $derived(
		rows.filter((r) => r.exerciseId && r.weight > 0 && r.sets > 0).length
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

	async function handleCreate(name: string, rowId: string, group: MuscleGroup) {
		const ex = await strengthStore.createExercise(name, group);
		setExercise(rowId, ex.id);
		toasts.success(`Создано «${ex.name}»`);
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
			rows = makeTemplate();
		} finally {
			saving = false;
		}
	}

	const setsForProgress = $derived(progressExId ? strengthStore.setsByExercise(progressExId) : []);

	$effect(() => {
		if (!progressExId && strengthStore.exercises.length > 0) {
			const first = strengthStore.exercises.find((e) => !e.hidden);
			if (first) progressExId = first.id;
		}
	});
</script>

<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 sm:pt-10">
	<header class="flex items-center gap-2">
		<BackButton fallback="/sport" />
		<div class="min-w-0 flex-1">
			<h1 class="text-2xl font-semibold tracking-tight">Силовая</h1>
			<p class="text-sm text-(--color-fg-mute)">{formatRu(today)}</p>
		</div>
		<button
			type="button"
			onclick={saveAll}
			disabled={saving || filledCount === 0}
			class="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-(--color-accent) px-3 text-sm font-medium text-white transition active:scale-[0.97] disabled:opacity-50"
		>
			{#if saving}
				<Loader2 size={16} class="animate-spin" />
			{:else}
				<Save size={16} />
			{/if}
			<span>Сохранить{filledCount > 0 ? ` · ${filledCount}` : ''}</span>
		</button>
	</header>

	<section class="hairline flex flex-col gap-3 rounded-3xl bg-(--color-bg-soft) p-3">
		<div
			class="grid grid-cols-[minmax(0,1fr)_72px_64px_32px] items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-(--color-fg-mute)"
		>
			<span>Упражнение</span>
			<span class="text-center">Вес, кг</span>
			<span class="text-center">Подх.</span>
			<span></span>
		</div>

		{#each SECTION_GROUPS as group (group)}
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
					<div class="grid grid-cols-[minmax(0,1fr)_72px_64px_32px] items-center gap-2">
						<ExerciseDropdown
							exercises={strengthStore.exercises}
							value={row.exerciseId}
							onselect={(id) => setExercise(row.id, id)}
							oncreate={(name) => handleCreate(name, row.id, group)}
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
							class="hairline rounded-xl bg-(--color-bg-mute) px-2 py-1.5 text-center text-sm tabular-nums outline-none placeholder:text-(--color-fg-mute)"
						/>
						<input
							type="number"
							inputmode="numeric"
							min="0"
							step="1"
							bind:value={row.sets}
							placeholder="0"
							class="hairline rounded-xl bg-(--color-bg-mute) px-2 py-1.5 text-center text-sm tabular-nums outline-none placeholder:text-(--color-fg-mute)"
						/>
						<button
							type="button"
							onclick={() => removeRow(row.id)}
							class="grid size-8 place-items-center rounded-lg text-(--color-fg-mute) hover:bg-(--color-bg-mute) hover:text-rose-400 disabled:opacity-30"
							aria-label="Удалить строку"
							disabled={rowsByGroup(group).length <= 1}
						>
							<Trash2 size={14} />
						</button>
					</div>
				{/each}

				<button
					type="button"
					onclick={() => addRow(group)}
					class="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-(--color-border) py-1.5 text-xs text-(--color-fg-mute) hover:bg-(--color-bg-mute) hover:text-(--color-fg)"
				>
					<Plus size={12} /> Ещё в «{MUSCLE_GROUP_LABELS[group]}»
				</button>
			</div>
		{/each}

		<p class="px-1 pt-1 text-[11px] text-(--color-fg-mute)">
			Подход = {DEFAULT_REPS} повторений по дефолту. Список упражнений тянется из каталога.
		</p>
	</section>

	<section>
		<div class="mb-2 flex items-center justify-between px-1">
			<h2 class="text-sm font-medium text-(--color-fg-mute)">Сегодня уже записано</h2>
			<a
				href={`${base}/sport/strength/exercises`}
				onclick={openCatalog}
				class="inline-flex items-center gap-1 text-xs text-(--color-fg-mute) hover:text-(--color-fg)"
			>
				<ListChecks size={12} /> Каталог
			</a>
		</div>
		<WorkoutLog date={today} />
	</section>

	<section class="hairline flex flex-col gap-2 rounded-3xl bg-(--color-bg-soft) p-4">
		<div class="flex items-center justify-between gap-2">
			<h3 class="text-sm font-medium">Прогресс 1RM (Epley)</h3>
			<div class="w-44 max-w-[60%]">
				<ExerciseDropdown
					exercises={strengthStore.exercises}
					value={progressExId}
					onselect={(id) => (progressExId = id)}
					compact
				/>
			</div>
		</div>
		<ProgressChart sets={setsForProgress} />
	</section>
</div>
