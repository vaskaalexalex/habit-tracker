<script lang="ts">
	import { page } from '$app/state';
	import { strengthStore } from '$stores/strength.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import { formatRu } from '$utils/dates';
	import { buildRowsFromSets } from '$utils/strength-rows';
	import {
		MUSCLE_GROUP_LABELS,
		MUSCLE_GROUP_ORDER,
		type MuscleGroup
	} from '$supabase/types';

	const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

	const dateParam = $derived(page.params.date ?? '');
	const isValidDate = $derived(ISO_RE.test(dateParam));

	const daySets = $derived(isValidDate ? strengthStore.setsForDate(dateParam) : []);
	const rows = $derived(
		daySets.length === 0 ? [] : buildRowsFromSets(daySets, strengthStore.exercises)
	);
	const groupsInOrder = $derived(
		MUSCLE_GROUP_ORDER.filter((g) => rows.some((r) => r.group === g))
	);
	const exerciseNameById = $derived.by(() => {
		const m = new Map<string, string>();
		for (const ex of strengthStore.exercises) m.set(ex.id, ex.name);
		return m;
	});

	function rowsByGroup(group: MuscleGroup) {
		return rows.filter((r) => r.group === group);
	}
</script>

<div class="page-shell">
	<PageHeader
		backFallback="/sport/strength"
		kicker="Тренировка"
		title="Силовая"
		subtitle={isValidDate ? formatRu(dateParam) : 'Некорректная дата'}
	/>

	{#if !isValidDate}
		<section
			class="hairline rounded-3xl bg-(--color-bg-soft) p-4 text-sm text-(--color-fg-mute)"
		>
			Некорректный формат даты. Ожидается <code>YYYY-MM-DD</code>.
		</section>
	{:else if !strengthStore.loaded}
		<section
			class="hairline rounded-3xl bg-(--color-bg-soft) p-4 text-sm text-(--color-fg-mute)"
		>
			Загрузка тренировки…
		</section>
	{:else if rows.length === 0}
		<section
			class="hairline rounded-3xl bg-(--color-bg-soft) p-4 text-sm text-(--color-fg-mute)"
		>
			Тренировки за этот день не было.
		</section>
	{:else}
		<section class="hairline flex flex-col gap-3 rounded-3xl bg-(--color-bg-soft) p-3">
			<div
				class="grid grid-cols-[minmax(0,1fr)_72px_64px] items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-(--color-fg-mute)"
			>
				<span>Упражнение</span>
				<span class="text-center">Вес, кг</span>
				<span class="text-center">Подх.</span>
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
						<div
							class="grid grid-cols-[minmax(0,1fr)_72px_64px] items-center gap-2 rounded-xl bg-(--color-bg-mute) px-2 py-1.5"
						>
							<span class="truncate text-sm">
								{row.exerciseId ? (exerciseNameById.get(row.exerciseId) ?? '—') : '—'}
							</span>
							<span class="text-center text-base tabular-nums">{row.weight}</span>
							<span class="text-center text-base tabular-nums">{row.sets}</span>
						</div>
					{/each}
				</div>
			{/each}
		</section>
	{/if}
</div>
