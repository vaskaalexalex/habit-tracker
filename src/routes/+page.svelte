<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { habitsStore } from '$stores/habits.svelte';
	import { strengthStore } from '$stores/strength.svelte';
	import { cardioStore } from '$stores/cardio.svelte';
	import { journalStore } from '$stores/journal.svelte';
	import { journalHabitBackedByWriting, reconcileJournalCompletions } from '$stores/auto-complete';
	import { profileStore } from '$stores/profile.svelte';
	import DashboardHabitTile from '$components/DashboardHabitTile.svelte';
	import HabitHeatmap from '$components/HabitHeatmap.svelte';
	import TodayRing from '$components/TodayRing.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import { HABIT_ORDER } from '$supabase/types';
	import type { HabitType, ISODate } from '$supabase/types';
	import { todayStore } from '$stores/today.svelte';
	import { dayHeadKicker, formatRu, isISODate } from '$utils/dates';
	import {
		isViewingDate as isViewingDateOnPage,
		resolveViewDate,
		withViewDate
	} from '$lib/nav/view-date';

	const today = $derived(todayStore.today);

	const viewDate = $derived(resolveViewDate($page.url.searchParams, today));

	const viewingToday = $derived(viewDate === today);
	const headKicker = $derived(dayHeadKicker(viewDate, today));

	const journalEntryForView = $derived(journalStore.entries.find((e) => e.date === viewDate));

	$effect(() => {
		void journalStore.entries;
		void habitsStore.completions;
		void reconcileJournalCompletions();
	});

	$effect(() => {
		const date = viewDate;
		if (!date) return;
		void journalStore.loadDay(date);
	});

	$effect(() => {
		const raw = $page.url.searchParams.get('date');
		if (raw && raw === today) {
			void goto(`${base}/`, { replaceState: true, keepFocus: true, noScroll: true });
		}
	});

	$effect(() => {
		void viewDate;
		prevAllDone = null;
	});

	function handle(habit: HabitType) {
		const date = viewDate;
		if (habit === 'sport') {
			let href: string;
			if (viewingToday) {
				if (habitsStore.isCompleted('sport', date)) {
					href = `${base}/sport`;
				} else {
					const hasStrength = strengthStore.setsForDate(date).length > 0;
					const hasCardio = cardioStore.items.some((c) => c.date === date);
					href =
						hasStrength && !hasCardio
							? `${base}/sport/strength`
							: !hasStrength && hasCardio
								? `${base}/sport/cardio`
								: `${base}/sport`;
				}
			} else {
				href = withViewDate(`${base}/sport`, date, today);
			}
			const cur = `${$page.url.pathname}${$page.url.search}`;
			if (cur !== href) void goto(href);
			return;
		}
		if (habit === 'journal') {
			const href = withViewDate(`${base}/journal`, date, today);
			const cur = `${$page.url.pathname}${$page.url.search}`;
			if (cur !== href) void goto(href);
			return;
		}
		void habitsStore.toggle(habit, date);
	}

	const completedOnView = $derived.by(() => {
		void journalStore.entries;
		void journalStore.loaded;
		void habitsStore.completions;
		void journalEntryForView;
		const set = new Set<HabitType>();
		for (const h of HABIT_ORDER) {
			if (h === 'journal') {
				if (
					habitsStore.isCompleted('journal', viewDate) &&
					journalHabitBackedByWriting(journalEntryForView)
				) {
					set.add(h);
				}
				continue;
			}
			if (habitsStore.isCompleted(h, viewDate)) set.add(h);
		}
		return set;
	});

	const allDone = $derived(completedOnView.size === HABIT_ORDER.length);

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
		return completedOnView.has(h);
	}

	function onTileClick(habit: HabitType) {
		handle(habit);
	}

	function openHabitDay(date: string) {
		if (!isISODate(date)) return;
		if (isViewingDateOnPage($page.url.searchParams, date, today)) return;
		const href = date === today ? `${base}/` : `${base}/?date=${date}`;
		void goto(href, { keepFocus: true, noScroll: true });
	}

	function goToToday() {
		if (viewingToday) return;
		void goto(`${base}/`, { keepFocus: true, noScroll: true });
	}
</script>

<div class="page-shell min-h-0 flex-1 gap-3 max-[380px]:gap-2 sm:gap-5 sm:pb-3">
	<PageHeader
		kicker={headKicker}
		title={formatRu(viewDate)}
		subtitle={profileStore.name.trim() || undefined}
	>
		{#if !viewingToday}
			<button
				type="button"
				class="tap-target w-fit text-xs font-medium text-(--color-accent) underline-offset-2 hover:underline"
				onclick={goToToday}
			>
				Вернуться к сегодня
			</button>
		{/if}
	</PageHeader>

	<div
		class="home-stats-row hairline flex shrink-0 items-end justify-between gap-2 rounded-xl bg-(--color-bg-soft) px-2.5 py-2 sm:rounded-2xl sm:px-3 sm:py-3"
		class:home-stats-row--pulse={statsRowPulse}
		class:home-stats-row--filled={allDone}
	>
		<span class="home-stats-row__fill" class:home-stats-row__fill--on={allDone} aria-hidden="true"
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
				{completedOnView.size}<span
					class="home-stats-row__total text-(--color-fg-mute)"
					style="font-size: 60%;">/{HABIT_ORDER.length}</span
				>
			</p>
		</div>
		<div class="relative z-[1]">
			<TodayRing completed={completedOnView} size={92} />
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
					streak={habitsStore.streak(habit, viewDate)}
					size="compact"
					flipVisualOnClick={habit === 'coding' || habit === 'reading'}
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
			onDayClick={openHabitDay}
		/>
	</section>
</div>
