<script lang="ts">
	import HabitHeatmap from '$components/HabitHeatmap.svelte';
	import TodayRing from '$components/TodayRing.svelte';
	import PreviewHabitTile from '../atoms/PreviewHabitTile.svelte';
	import type { DesignPreviewMocks } from '../types';
	import { HABIT_ORDER } from '$supabase/types';
	import type { HabitType } from '$supabase/types';

	let { completions, completedToday, streaks, todayLabel, profileName }: DesignPreviewMocks =
		$props();

	const allDone = $derived(completedToday.size === HABIT_ORDER.length);

	function done(h: HabitType): boolean {
		return completedToday.has(h);
	}
</script>

<div class="preview-shell-v3 flex flex-col gap-5 pb-2">
	<div class="glass hairline rounded-[1.75rem] px-5 py-6">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold tracking-tight">Привычки</h1>
				<p class="mt-1 text-sm text-(--color-fg-mute)">{todayLabel}</p>
				{#if profileName.trim()}
					<p class="mt-2 text-xs text-(--color-fg-mute)">{profileName}</p>
				{/if}
			</div>
			<TodayRing completed={completedToday} size={96} />
		</div>
		{#if allDone}
			<p class="mt-4 text-sm font-medium text-emerald-400/95">Все цели на сегодня выполнены.</p>
		{:else}
			<p class="mt-4 text-sm text-(--color-fg-mute)">
				<span class="tabular-nums font-semibold text-(--color-fg)">{completedToday.size}</span>
				из {HABIT_ORDER.length} отмечено
			</p>
		{/if}
	</div>

	<div class="glass hairline rounded-[1.75rem] p-4">
		<p class="mb-3 text-xs font-medium uppercase tracking-wide text-(--color-fg-mute)">Фокус</p>
		<div class="grid grid-cols-2 gap-3">
			{#each HABIT_ORDER as habit (habit)}
				<PreviewHabitTile {habit} completed={done(habit)} streak={streaks[habit]} glass={true} />
			{/each}
		</div>
	</div>

	<div class="glass hairline overflow-hidden rounded-[1.75rem]">
		<HabitHeatmap
			{completions}
			sectionClass="border-0 bg-transparent p-3 shadow-none sm:p-4"
		/>
	</div>
</div>
