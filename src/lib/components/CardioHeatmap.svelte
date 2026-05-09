<script lang="ts">
	import Heatmap from '$components/Heatmap.svelte';
	import { CARDIO_LABELS, type CardioWorkout, type ISODate } from '$supabase/types';

	interface Props {
		items: CardioWorkout[];
		cellSize?: number;
		cellGap?: number;
		sectionClass?: string;
	}

	let { items, cellSize, cellGap, sectionClass }: Props = $props();

	const itemsByDate = $derived.by(() => {
		const m = new Map<string, CardioWorkout[]>();
		for (const it of items) {
			const arr = m.get(it.date) ?? [];
			arr.push(it);
			m.set(it.date, arr);
		}
		return m;
	});

	const levels = $derived.by(() => {
		const m = new Map<ISODate, number>();
		for (const iso of itemsByDate.keys()) m.set(iso as ISODate, 4);
		return m;
	});

	const dataYears = $derived.by(() => {
		const set = new Set<number>();
		for (const it of items) {
			const y = parseInt(it.date.slice(0, 4), 10);
			if (!Number.isNaN(y)) set.add(y);
		}
		return [...set];
	});

	function entriesFor(iso: string): CardioWorkout[] {
		return itemsByDate.get(iso) ?? [];
	}
</script>

<Heatmap
	{levels}
	{dataYears}
	{cellSize}
	{cellGap}
	{sectionClass}
	counterLabel="Кардио"
	ariaLabel="Активность кардио по дням"
>
	{#snippet tooltip({ iso })}
		{@const list = entriesFor(iso)}
		{#if list.length === 0}
			<p class="pointer-events-none text-(--color-fg-mute)">нет активности</p>
		{:else}
			<ul class="pointer-events-none mt-0.5 flex flex-col gap-0.5 text-(--color-fg-mute)">
				{#each list as it (it.id)}
					<li class="break-words">
						<span class="text-(--color-fg)">{CARDIO_LABELS[it.type]}</span>
						<span class="tabular-nums"> · {it.duration_min} мин</span>
						{#if it.distance_km}<span class="tabular-nums"> · {it.distance_km} км</span>{/if}
						{#if it.note} · {it.note}{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/snippet}
</Heatmap>
