<script lang="ts">
	import HabitHeatmap from '$components/HabitHeatmap.svelte';
	import TodayRing from '$components/TodayRing.svelte';
	import PreviewHabitTile from '../atoms/PreviewHabitTile.svelte';
	import type { DesignPreviewMocks } from '../types';
	import { HABIT_ORDER } from '$supabase/types';
	import type { HabitType } from '$supabase/types';

	let { completions, completedToday, streaks, todayLabel, profileName }: DesignPreviewMocks =
		$props();

	const secondary = $derived(HABIT_ORDER.filter((h) => h !== 'sport'));

	const allDone = $derived(completedToday.size === HABIT_ORDER.length);

	function done(h: HabitType): boolean {
		return completedToday.has(h);
	}
</script>

<div class="preview-shell-v5 flex flex-col gap-6">
	<header class="flex items-start justify-between gap-3 px-0.5">
		<div>
			<p class="text-xs font-bold uppercase tracking-[0.25em] text-(--color-accent)">Трекер</p>
			<h1 class="mt-2 text-lg font-bold tracking-tight">Привычки · {todayLabel}</h1>
			{#if profileName.trim()}
				<p class="mt-1 text-xs text-(--color-fg-mute)">{profileName}</p>
			{/if}
		</div>
		<div class="neon-ring-wrap rounded-full p-0.5">
			<TodayRing completed={completedToday} size={104} />
		</div>
	</header>

	<section class="relative overflow-hidden rounded-3xl border border-(--color-border)">
		<div
			class="pointer-events-none absolute inset-0 opacity-80"
			style="background: linear-gradient(135deg, oklch(0.55 0.22 35 / 0.35), transparent 45%, oklch(0.45 0.15 290 / 0.25));"
		></div>
		<div class="relative p-4">
			<p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-(--color-fg-mute)">
				Приоритет
			</p>
			<PreviewHabitTile
				habit="sport"
				completed={done('sport')}
				streak={streaks.sport}
				size="hero"
			/>
		</div>
	</section>

	<section aria-label="Остальное">
		<p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-(--color-fg-mute)">
			Ещё на сегодня
		</p>
		<div class="grid grid-cols-3 gap-2">
			{#each secondary as habit (habit)}
				<PreviewHabitTile {habit} completed={done(habit)} streak={streaks[habit]} size="md" />
			{/each}
		</div>
	</section>

	{#if allDone}
		<p class="text-center text-sm font-semibold text-emerald-400">Максимум на сегодня.</p>
	{/if}

	<HabitHeatmap
		{completions}
		months={6}
		cellSize={11}
		cellGap={2}
		sectionClass="neon-heatmap-frame"
	/>
</div>
