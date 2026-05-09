<script lang="ts">
	import Heatmap from '$components/Heatmap.svelte';
	import type { ISODate, JournalEntry } from '$supabase/types';

	interface Props {
		entries: JournalEntry[];
		onDayClick?: (iso: ISODate) => void;
		cellSize?: number;
		cellGap?: number;
		sectionClass?: string;
	}

	let { entries, onDayClick, cellSize, cellGap, sectionClass }: Props = $props();

	function activityLevel(e: JournalEntry): number {
		const text = e.content.trim();
		if (text.length === 0 && e.mood == null) return 0;
		if (e.mood != null) {
			const m = e.mood;
			if (m <= 2) return 1;
			if (m <= 5) return 2;
			if (m <= 7) return 3;
			return 4;
		}
		return 2;
	}

	const levels = $derived.by(() => {
		const m = new Map<ISODate, number>();
		for (const e of entries) m.set(e.date as ISODate, activityLevel(e));
		return m;
	});

	const entryByDate = $derived.by(() => {
		const m = new Map<string, JournalEntry>();
		for (const e of entries) m.set(e.date, e);
		return m;
	});

	const dataYears = $derived.by(() => {
		const set = new Set<number>();
		for (const e of entries) {
			const y = parseInt(e.date.slice(0, 4), 10);
			if (!Number.isNaN(y)) set.add(y);
		}
		return [...set];
	});
</script>

<Heatmap
	{levels}
	{dataYears}
	{cellSize}
	{cellGap}
	{sectionClass}
	{onDayClick}
	counterLabel="Записи"
	ariaLabel="Активность дневника по дням"
>
	{#snippet tooltip({ iso })}
		{@const entry = entryByDate.get(iso) ?? null}
		{#if !entry || activityLevel(entry) === 0}
			<p class="pointer-events-none text-(--color-fg-mute)">нет записи</p>
		{:else}
			{#if entry.mood != null}
				<p class="pointer-events-none text-(--color-fg-mute)">
					Настроение <span class="text-(--color-fg)">{entry.mood}</span>/10
				</p>
			{/if}
			{#if entry.content.trim()}
				<div
					class="pointer-events-auto mt-1 max-h-[min(240px,38vh)] overflow-y-auto overscroll-contain text-pretty break-words text-(--color-fg-soft)"
				>
					{entry.content.trim()}
				</div>
			{/if}
			{#if onDayClick}
				<p class="pointer-events-none mt-1 text-[10px] text-(--color-fg-mute)">
					Нажми, чтобы открыть
				</p>
			{/if}
		{/if}
	{/snippet}
</Heatmap>
