<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { isSamePathname } from '$lib/nav/same-pathname';
	import { habitsStore } from '$stores/habits.svelte';
	import { strengthStore } from '$stores/strength.svelte';
	import { cardioStore } from '$stores/cardio.svelte';
	import { journalStore } from '$stores/journal.svelte';
	import { journalHabitBackedByWriting, reconcileJournalCompletions } from '$stores/auto-complete';
	import { profileStore } from '$stores/profile.svelte';
	import DashboardHabitTile from '$components/DashboardHabitTile.svelte';
	import HabitHeatmap from '$components/HabitHeatmap.svelte';
	import TodayRing from '$components/TodayRing.svelte';
	import PageHeadText from '$components/PageHeadText.svelte';
	import { HABIT_ORDER } from '$supabase/types';
	import type { HabitType } from '$supabase/types';
	import { todayStore } from '$stores/today.svelte';
	import { formatRu } from '$utils/dates';

	const today = $derived(todayStore.today);

	const journalEntryToday = $derived(journalStore.entries.find((e) => e.date === today));

	$effect(() => {
		void journalStore.entries;
		void habitsStore.completions;
		void reconcileJournalCompletions();
	});

	function handle(habit: HabitType) {
		if (habit === 'sport') {
			if (habitsStore.isCompleted('sport', today)) {
				const home = `${base}/`;
				if (!isSamePathname($page.url.pathname, home)) void goto(home);
				return;
			}
			const hasStrength = strengthStore.setsForDate(today).length > 0;
			const hasCardio = cardioStore.items.some((c) => c.date === today);
			const href =
				hasStrength && !hasCardio
					? `${base}/sport/strength`
					: !hasStrength && hasCardio
						? `${base}/sport/cardio`
						: `${base}/sport`;
			if (!isSamePathname($page.url.pathname, href)) void goto(href);
			return;
		}
		if (habit === 'journal') {
			const href = `${base}/journal`;
			if (!isSamePathname($page.url.pathname, href)) void goto(href);
			return;
		}
		void habitsStore.toggle(habit, today);
	}

	const completedToday = $derived.by(() => {
		void journalStore.entries;
		void journalStore.loaded;
		void habitsStore.completions;
		void journalEntryToday;
		const set = new Set<HabitType>();
		for (const h of HABIT_ORDER) {
			if (h === 'journal') {
				if (
					habitsStore.isCompleted('journal', today) &&
					journalHabitBackedByWriting(journalEntryToday)
				) {
					set.add(h);
				}
				continue;
			}
			if (habitsStore.isCompleted(h, today)) set.add(h);
		}
		return set;
	});

	const allDone = $derived(completedToday.size === HABIT_ORDER.length);

	let statsRowPulse = $state(false);
	let prevAllDone: boolean | null = $state(null);
	$effect(() => {
		const cur = allDone;
		if (prevAllDone !== null && cur && !prevAllDone) {
			if (
				typeof navigator !== 'undefined' &&
				!window.matchMedia('(prefers-reduced-motion: reduce)').matches
			) {
				navigator.vibrate?.(15);
			}
			statsRowPulse = true;
			const id = window.setTimeout(() => {
				statsRowPulse = false;
			}, 980);
			prevAllDone = cur;
			return () => clearTimeout(id);
		}
		prevAllDone = cur;
	});

	function done(h: HabitType): boolean {
		return completedToday.has(h);
	}

	function onTileClick(habit: HabitType) {
		handle(habit);
	}
</script>

<div class="page-shell min-h-0 flex-1 gap-3 max-[380px]:gap-2 sm:gap-5 sm:pb-3">
	<div class="flex shrink-0 flex-col gap-1">
		<PageHeadText
			kicker="Сегодня"
			title={formatRu(today)}
			subtitle={profileStore.name.trim() || undefined}
		/>
	</div>

	<div
		class="home-stats-row hairline flex shrink-0 items-end justify-between gap-2 rounded-xl bg-(--color-bg-soft) px-2.5 py-2 sm:rounded-2xl sm:px-3 sm:py-3"
		class:home-stats-row--pulse={statsRowPulse}
		class:home-stats-row--filled={allDone}
	>
		<span
			class="home-stats-row__fill"
			class:home-stats-row__fill--on={allDone}
			aria-hidden="true"
		></span>
		<div class="relative z-[1] min-w-0">
			<p
				class="home-stats-row__label text-xs font-semibold uppercase tracking-wide text-(--color-fg-mute) sm:text-sm"
			>
				Выполнено
			</p>
			<p
				class="mt-1 font-black tabular-nums tracking-tight text-(--color-fg)"
				style="font-size: clamp(1.75rem, 8.5vw, 3rem); line-height: 0.95;"
			>
				{completedToday.size}<span
					class="home-stats-row__total text-(--color-fg-mute)"
					style="font-size: 60%;">/{HABIT_ORDER.length}</span
				>
			</p>
		</div>
		<div class="relative z-[1]">
			<TodayRing completed={completedToday} size={92} />
		</div>
	</div>

	<section class="flex min-h-0 min-w-0 shrink flex-col" aria-label="Привычки">
		<h2
			class="mb-1.5 shrink-0 text-[9px] font-bold uppercase tracking-wider text-(--color-fg-mute) sm:mb-2 sm:text-[10px]"
		>
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
