<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { habitsStore } from '$stores/habits.svelte';
	import { strengthStore } from '$stores/strength.svelte';
	import { cardioStore } from '$stores/cardio.svelte';
	import { profileStore } from '$stores/profile.svelte';
	import DashboardHabitTile from '$components/DashboardHabitTile.svelte';
	import HabitHeatmap from '$components/HabitHeatmap.svelte';
	import TodayRing from '$components/TodayRing.svelte';
	import { HABIT_ORDER } from '$supabase/types';
	import type { HabitType } from '$supabase/types';
	import { todayStore } from '$stores/today.svelte';
	import { formatRu } from '$utils/dates';

	const today = $derived(todayStore.today);

	function handle(habit: HabitType) {
		if (habit === 'sport') {
			const hasStrength = strengthStore.setsForDate(today).length > 0;
			const hasCardio = cardioStore.items.some((c) => c.date === today);
			if (hasStrength && !hasCardio) void goto(`${base}/sport/strength`);
			else if (!hasStrength && hasCardio) void goto(`${base}/sport/cardio`);
			else void goto(`${base}/sport`);
			return;
		}
		if (habit === 'journal') {
			void goto(`${base}/journal`);
			return;
		}
		void habitsStore.toggle(habit, today);
	}

	const completedToday = $derived.by(() => {
		const set = new Set<HabitType>();
		for (const h of HABIT_ORDER) {
			if (habitsStore.isCompleted(h, today)) set.add(h);
		}
		return set;
	});

	const allDone = $derived(completedToday.size === HABIT_ORDER.length);

	function done(h: HabitType): boolean {
		return completedToday.has(h);
	}

	function onTileClick(habit: HabitType) {
		handle(habit);
	}
</script>

<div
	class="page-shell min-h-0 flex-1 gap-3 max-[380px]:gap-2 sm:gap-5 sm:pb-3"
>
	<div class="flex shrink-0 flex-col gap-1">
		<p class="page-kicker">Сегодня</p>
		<p class="page-hero-title">{formatRu(today)}</p>
		{#if profileStore.name.trim()}
			<p class="page-subtitle truncate">{profileStore.name}</p>
		{/if}
	</div>

	<div
		class="hairline flex shrink-0 items-end justify-between gap-2 rounded-xl bg-(--color-bg-soft) px-2.5 py-2 sm:rounded-2xl sm:px-3 sm:py-3"
	>
		<div class="min-w-0">
			<p class="text-[9px] font-semibold uppercase tracking-wide text-(--color-fg-mute) sm:text-[10px]">
				Выполнено
			</p>
			<p
				class="mt-0.5 font-black tabular-nums tracking-tight text-(--color-fg)"
				style="font-size: clamp(1.35rem, 7vw, 2.35rem); line-height: 0.95;"
			>
				{completedToday.size}<span class="text-(--color-fg-mute)" style="font-size: 55%;"
					>/{HABIT_ORDER.length}</span
				>
			</p>
		</div>
		<TodayRing completed={completedToday} size={92} />
	</div>

	<section class="flex min-h-0 min-w-0 shrink flex-col" aria-label="Привычки">
		<h2 class="mb-1.5 shrink-0 text-[9px] font-bold uppercase tracking-wider text-(--color-fg-mute) sm:mb-2 sm:text-[10px]">
			Привычки
		</h2>
		<div class="grid shrink-0 grid-cols-2 gap-2 sm:gap-3">
			{#each HABIT_ORDER as habit (habit)}
				<DashboardHabitTile
					{habit}
					completed={done(habit)}
					streak={habitsStore.streak(habit, today)}
					size="compact"
					onclick={() => onTileClick(habit)}
				/>
			{/each}
		</div>
	</section>

	{#if allDone}
		<p class="shrink-0 text-center text-[10px] font-semibold leading-tight text-emerald-400 sm:text-[11px]">
			Всё готово.
		</p>
	{/if}

	<section id="activity" class="scroll-mt-4 shrink-0" aria-labelledby="home-activity-heading">
		<h2
			id="home-activity-heading"
			class="mb-2 text-[9px] font-bold uppercase tracking-wider text-(--color-fg-mute) sm:mb-2.5 sm:text-[10px]"
		>
			Активность
		</h2>
		<HabitHeatmap
			completions={habitsStore.completions}
			cellSize={10}
			cellGap={2}
			sectionClass="rounded-2xl p-3 sm:rounded-3xl sm:p-4"
		/>
	</section>
</div>
