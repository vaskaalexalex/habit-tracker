<script lang="ts">
	import '@fontsource-variable/fraunces/wght.css';
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

<div class="preview-shell-v4 flex flex-col gap-8">
	<header class="px-1">
		<p
			class="paper-display text-3xl font-medium leading-tight tracking-tight text-(--color-fg) sm:text-4xl"
		>
			Привычки
		</p>
		<p class="mt-3 text-sm leading-relaxed text-(--color-fg-soft)">{todayLabel}</p>
		{#if profileName.trim()}
			<p class="mt-2 text-sm italic text-(--color-fg-mute)">— {profileName}</p>
		{/if}
	</header>

	<section class="paper-sheet hairline rounded-sm px-5 py-6" aria-label="Прогресс дня">
		<div class="flex flex-wrap items-center gap-6">
			<TodayRing completed={completedToday} size={90} />
			<div>
				{#if allDone}
					<p class="paper-display text-xl text-(--color-fg)">Всё отмечено</p>
					<p class="mt-1 text-sm text-(--color-fg-mute)">Спокойный закрытый день.</p>
				{:else}
					<p class="text-sm text-(--color-fg-mute)">Сегодня готово</p>
					<p class="paper-display mt-1 text-3xl tabular-nums text-(--color-fg)">
						{completedToday.size}<span class="text-xl text-(--color-fg-mute)"
							>/{HABIT_ORDER.length}</span
						>
					</p>
				{/if}
			</div>
		</div>
	</section>

	<section class="paper-sheet hairline rounded-sm px-2 py-2" aria-label="Список привычек">
		{#each HABIT_ORDER as habit, i (habit)}
			<PreviewHabitRow
				{habit}
				completed={done(habit)}
				streak={streaks[habit]}
				density="compact"
				showDivider={i < HABIT_ORDER.length - 1}
			/>
		{/each}
	</section>

	<section class="paper-sheet hairline rounded-sm p-4">
		<HabitHeatmap {completions} />
	</section>
</div>

<style>
	.paper-display {
		font-family: 'Fraunces Variable', Georgia, 'Times New Roman', serif;
		font-variation-settings:
			'SOFT' 50,
			'WONK' 0.4;
	}
</style>
