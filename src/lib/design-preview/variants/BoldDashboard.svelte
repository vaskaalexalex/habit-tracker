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

	const codingReading = ['coding', 'reading'] as const;

	function done(h: HabitType): boolean {
		return completedToday.has(h);
	}
</script>

<div class="preview-shell-v2 flex flex-col gap-6">
	<div>
		<p class="page-kicker">Сегодня</p>
		<p
			class="mt-2 font-black uppercase leading-none tracking-tighter text-(--color-fg)"
			style="font-size: clamp(2rem, 12vw, 3rem);"
		>
			{todayLabel}
		</p>
		{#if profileName.trim()}
			<p class="mt-2 text-sm font-medium text-(--color-fg-mute)">{profileName}</p>
		{/if}
	</div>

	<div
		class="hairline flex items-end justify-between gap-4 rounded-2xl bg-(--color-bg-soft) px-4 py-5"
	>
		<div>
			<p class="text-xs font-semibold uppercase tracking-wide text-(--color-fg-mute)">Выполнено</p>
			<p
				class="mt-1 font-black tabular-nums tracking-tight text-(--color-fg)"
				style="font-size: clamp(3rem, 18vw, 4.5rem); line-height: 0.95;"
			>
				{completedToday.size}<span class="text-(--color-fg-mute)" style="font-size: 55%;"
					>/{HABIT_ORDER.length}</span
				>
			</p>
		</div>
		<TodayRing completed={completedToday} size={118} />
	</div>

	<section aria-label="Привычки">
		<h2 class="mb-3 text-xs font-bold uppercase tracking-wider text-(--color-fg-mute)">Матрица</h2>
		<div class="grid grid-cols-2 gap-3">
			<div class="row-span-2 flex min-h-0">
				<PreviewHabitTile
					habit="sport"
					completed={done('sport')}
					streak={streaks.sport}
					size="lg"
					stretch={true}
				/>
			</div>
			{#each codingReading as h (h)}
				<PreviewHabitTile habit={h} completed={done(h)} streak={streaks[h]} size="md" />
			{/each}
			<div class="col-span-2">
				<PreviewHabitTile
					habit="journal"
					completed={done('journal')}
					streak={streaks.journal}
					size="md"
				/>
			</div>
		</div>
	</section>

	{#if allDone}
		<p class="text-center text-sm font-semibold text-emerald-400">День закрыт полностью.</p>
	{/if}

	<HabitHeatmap {completions} months={6} />
</div>
