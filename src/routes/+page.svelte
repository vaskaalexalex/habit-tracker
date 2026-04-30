<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { habitsStore } from '$stores/habits.svelte';
	import { strengthStore } from '$stores/strength.svelte';
	import { cardioStore } from '$stores/cardio.svelte';
	import { profileStore } from '$stores/profile.svelte';
	import HabitCard from '$components/HabitCard.svelte';
	import HabitHeatmap from '$components/HabitHeatmap.svelte';
	import MonthChart from '$components/MonthChart.svelte';
	import TodayRing from '$components/TodayRing.svelte';
	import { HABIT_ORDER } from '$supabase/types';
	import type { HabitType } from '$supabase/types';
	import { isoToday, formatRu } from '$utils/dates';

	const today = $derived(isoToday());

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

	function isToggleable(habit: HabitType): boolean {
		return habit === 'coding' || habit === 'reading';
	}

	const completedToday = $derived.by(() => {
		const set = new Set<HabitType>();
		for (const h of HABIT_ORDER) {
			if (habitsStore.isCompleted(h, today)) set.add(h);
		}
		return set;
	});

	const allDone = $derived(completedToday.size === HABIT_ORDER.length);
</script>

<div
	class="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pt-6 pb-4 sm:h-[calc(100dvh-7rem)] sm:overflow-hidden sm:pt-8"
>
	<header class="flex items-baseline justify-between gap-2">
		<h1 class="min-w-0 truncate text-2xl font-semibold tracking-tight">
			{#if profileStore.name.trim()}
				<span class="text-(--color-fg-mute)">{profileStore.name}:</span>
				Привычки
			{:else}
				Привычки
			{/if}
		</h1>
		<span class="shrink-0 text-sm text-(--color-fg-mute)">{formatRu(today)}</span>
	</header>

	<section class="grid grid-cols-4 gap-2">
		{#each HABIT_ORDER as habit (habit)}
			<HabitCard
				{habit}
				completed={habitsStore.isCompleted(habit, today)}
				streak={habitsStore.streak(habit, today)}
				toggleable={isToggleable(habit)}
				onclick={() => handle(habit)}
			/>
		{/each}
	</section>

	<section
		class="hairline relative flex items-center gap-4 overflow-hidden rounded-3xl bg-(--color-bg-soft) p-4"
	>
		{#if allDone}
			<div
				class="bg-gradient-to-br pointer-events-none absolute inset-0 from-emerald-500/20 to-emerald-500/0"
			></div>
		{/if}
		<TodayRing completed={completedToday} size={92} />
		<div class="relative min-w-0 flex-1">
			{#if allDone}
				<p class="text-lg font-semibold tracking-tight">Всё выполнено!</p>
				<p class="text-sm text-(--color-fg-mute)">Отличный день. Поддержи серию завтра.</p>
			{:else}
				<p class="text-lg font-semibold tracking-tight">
					<span class="tabular-nums">{completedToday.size}</span>
					<span class="text-(--color-fg-mute)">из {HABIT_ORDER.length}</span>
				</p>
				<p class="text-sm text-(--color-fg-mute)">привычек сегодня</p>
			{/if}
		</div>
	</section>

	<HabitHeatmap completions={habitsStore.completions} months={6} />
	<MonthChart completions={habitsStore.completions} />
</div>
