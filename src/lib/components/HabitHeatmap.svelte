<script lang="ts">
	import Heatmap from '$components/Heatmap.svelte';
	import { HABIT_LABELS, HABIT_ORDER, type HabitCompletion, type ISODate } from '$supabase/types';

	interface Props {
		completions: HabitCompletion[];
		cellSize?: number;
		cellGap?: number;
		sectionClass?: string;
	}

	let { completions, cellSize, cellGap, sectionClass }: Props = $props();

	const doneByDate = $derived.by(() => {
		const map = new Map<string, Set<string>>();
		for (const c of completions) {
			const set = map.get(c.date) ?? new Set<string>();
			set.add(c.habit_type);
			map.set(c.date, set);
		}
		return map;
	});

	const levels = $derived.by(() => {
		const m = new Map<ISODate, number>();
		for (const [iso, set] of doneByDate) m.set(iso as ISODate, set.size);
		return m;
	});

	const dataYears = $derived.by(() => {
		const set = new Set<number>();
		for (const c of completions) {
			const y = parseInt(c.date.slice(0, 4), 10);
			if (!Number.isNaN(y)) set.add(y);
		}
		return [...set];
	});

	function doneList(iso: string): string[] {
		const set = doneByDate.get(iso);
		if (!set || set.size === 0) return [];
		return HABIT_ORDER.filter((h) => set.has(h)).map((h) => HABIT_LABELS[h]);
	}
</script>

<Heatmap
	{levels}
	{dataYears}
	{cellSize}
	{cellGap}
	{sectionClass}
	counterLabel="Привычки"
	ariaLabel="Активность привычек"
>
	{#snippet tooltip({ iso })}
		{@const list = doneList(iso)}
		{#if list.length === 0}
			<p class="pointer-events-none text-(--color-fg-mute)">без отметок</p>
		{:else}
			<p class="pointer-events-none break-words text-(--color-fg-mute)">
				{list.join(', ')}
				<span class="text-(--color-fg)">({list.length}/{HABIT_ORDER.length})</span>
			</p>
		{/if}
	{/snippet}
</Heatmap>
