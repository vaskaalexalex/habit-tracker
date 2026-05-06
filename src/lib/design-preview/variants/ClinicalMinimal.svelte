<script lang="ts">
	import HabitHeatmap from '$components/HabitHeatmap.svelte';
	import TodayRing from '$components/TodayRing.svelte';
	import PreviewHabitRow from '../atoms/PreviewHabitRow.svelte';
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

<div class="preview-shell-v1 flex flex-col gap-8">
	<header class="flex flex-col gap-1 border-b border-(--color-border) pb-6">
		<p class="text-[11px] font-medium uppercase tracking-[0.2em] text-(--color-fg-mute)">Сегодня</p>
		<h1
			class="font-semibold tracking-tight text-(--color-fg)"
			style="font-size: var(--preview-title-size, 1.75rem);"
		>
			{todayLabel}
		</h1>
		{#if profileName.trim()}
			<p class="text-sm text-(--color-fg-mute)">{profileName}</p>
		{/if}
	</header>

	<section aria-label="Привычки">
		<h2 class="mb-3 text-xs font-medium uppercase tracking-wide text-(--color-fg-mute)">
			Привычки
		</h2>
		<div class="rounded-2xl border border-(--color-border) bg-(--color-bg) px-1">
			{#each HABIT_ORDER as habit, i (habit)}
				<PreviewHabitRow
					{habit}
					completed={done(habit)}
					streak={streaks[habit]}
					minimal={true}
					showDivider={i < HABIT_ORDER.length - 1}
				/>
			{/each}
		</div>
	</section>

	<section
		class="flex items-center gap-6 border border-(--color-border) bg-(--color-bg) px-5 py-6"
		style="border-radius: var(--preview-radius-card, 1rem);"
	>
		<TodayRing completed={completedToday} size={78} />
		<div class="min-w-0 flex-1">
			{#if allDone}
				<p class="text-base font-semibold">Всё выполнено</p>
				<p class="mt-1 text-sm text-(--color-fg-mute)">День закрыт по всем пунктам.</p>
			{:else}
				<p class="text-sm text-(--color-fg-mute)">Прогресс дня</p>
				<p class="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
					{completedToday.size}<span class="text-lg font-medium text-(--color-fg-mute)"
						>/{HABIT_ORDER.length}</span
					>
				</p>
			{/if}
		</div>
	</section>

	<HabitHeatmap
		{completions}
		months={6}
		cellSize={9}
		cellGap={4}
		sectionClass="px-7 py-10 sm:px-10 sm:py-12"
	/>
</div>
