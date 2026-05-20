<script lang="ts">
	import Heatmap from '$components/Heatmap.svelte';
	import type { Exercise, ISODate, WorkoutSet } from '$supabase/types';
	import { buildRowsFromSets } from '$utils/strength-rows';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { todayStore } from '$stores/today.svelte';
	import { withViewDate } from '$lib/nav/view-date';

	interface Props {
		sets: WorkoutSet[];
		exercises: Exercise[];
		cellSize?: number;
		cellGap?: number;
		sectionClass?: string;
	}

	let { sets, exercises, cellSize, cellGap, sectionClass }: Props = $props();

	const today = $derived(todayStore.today);

	const setsByDate = $derived.by(() => {
		const m = new Map<string, WorkoutSet[]>();
		for (const s of sets) {
			const arr = m.get(s.date) ?? [];
			arr.push(s);
			m.set(s.date, arr);
		}
		return m;
	});

	const levels = $derived.by(() => {
		const m = new Map<ISODate, number>();
		for (const iso of setsByDate.keys()) m.set(iso as ISODate, 4);
		return m;
	});

	const dataYears = $derived.by(() => {
		const set = new Set<number>();
		for (const s of sets) {
			const y = parseInt(s.date.slice(0, 4), 10);
			if (!Number.isNaN(y)) set.add(y);
		}
		return [...set];
	});

	const exerciseNameById = $derived.by(() => {
		const m = new Map<string, string>();
		for (const ex of exercises) m.set(ex.id, ex.name);
		return m;
	});

	function tooltipRows(iso: string): Array<{ name: string; weight: number; sets: number }> {
		const day = setsByDate.get(iso);
		if (!day || day.length === 0) return [];
		return buildRowsFromSets(day, exercises).map((r) => ({
			name: r.exerciseId ? (exerciseNameById.get(r.exerciseId) ?? '—') : '—',
			weight: r.weight,
			sets: r.sets
		}));
	}

	function handleDayClick(iso: ISODate) {
		const href = withViewDate(`${base}/sport/strength`, iso, today);
		const cur = `${$page.url.pathname}${$page.url.search}`;
		if (cur === href) return;
		void goto(href);
	}
</script>

<Heatmap
	{levels}
	{dataYears}
	{cellSize}
	{cellGap}
	{sectionClass}
	onDayClick={handleDayClick}
	counterLabel="Тренировки"
	ariaLabel="Активность силовых тренировок по дням"
>
	{#snippet tooltip({ iso })}
		{@const list = tooltipRows(iso)}
		{#if list.length === 0}
			<p class="pointer-events-none text-(--color-fg-mute)">нет тренировки</p>
		{:else}
			<ul class="pointer-events-none mt-0.5 flex flex-col gap-0.5 text-(--color-fg-mute)">
				{#each list as row, i (i)}
					<li class="break-words">
						<span class="text-(--color-fg)">{row.name}</span>
						<span class="tabular-nums"> · {row.weight}×{row.sets}</span>
					</li>
				{/each}
			</ul>
			<p class="pointer-events-none mt-1 text-[10px] text-(--color-fg-mute)">
				Нажми, чтобы открыть
			</p>
		{/if}
	{/snippet}
</Heatmap>
