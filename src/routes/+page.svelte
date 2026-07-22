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
	import ArcadeHud from '$components/ArcadeHud.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import { skinStore } from '$stores/skin.svelte';
	import { gameStore } from '$stores/game.svelte';
	import { HABIT_ORDER } from '$supabase/types';
	import { habitColorVar } from '$lib/habit-visual';
	import type { HabitType } from '$supabase/types';
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
	const remaining = $derived(HABIT_ORDER.length - completedOnView.size);

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

<div class="page-shell gap-4 pb-3 sm:gap-5">
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

	{#if skinStore.skin === 'arcade'}
		<div class="flex shrink-0 flex-col gap-3">
			<ArcadeHud />
			<div
				class="home-stats-row hairline flex flex-col gap-2 bg-(--color-bg-soft) p-3"
				class:home-stats-row--pulse={statsRowPulse}
			>
				<div class="flex items-center justify-between gap-2">
					<span class="font-display text-sm tracking-wide text-(--color-fg)">
						ДЕНЬ · {formatRu(viewDate, 'dd.MM')}
					</span>
					{#if gameStore.combo > 0}
						<span class="font-display text-xs text-(--color-journal)">
							×{gameStore.combo} COMBO
						</span>
					{/if}
				</div>
				<div class="flex gap-1" aria-hidden="true">
					{#each HABIT_ORDER as habit (habit)}
						<span
							class="h-3 flex-1"
							style="background: {done(habit)
								? habitColorVar(habit)
								: 'var(--color-bg-mute)'}; box-shadow: inset 0 0 0 1px var(--color-fg-faint);"
						></span>
					{/each}
				</div>
				<div class="text-xs tabular-nums text-(--color-fg-mute)">
					{completedOnView.size}/{HABIT_ORDER.length} квеста{allDone
						? ' · День зачищен ✓'
						: ' · Зачисти день ▶'}
				</div>
			</div>
		</div>
	{:else}
		<div
			class="home-stats-row hairline flex shrink-0 items-center gap-4 rounded-3xl bg-(--color-bg-soft) p-4 sm:gap-5 sm:p-5"
			class:home-stats-row--pulse={statsRowPulse}
			class:home-stats-row--filled={allDone}
		>
			<span class="home-stats-row__fill" class:home-stats-row__fill--on={allDone} aria-hidden="true"
			></span>
			<div class="relative z-[1] shrink-0">
				<TodayRing completed={completedOnView} size={104} />
			</div>
			<div class="relative z-[1] flex min-w-0 flex-1 flex-col gap-2">
				<p
					class="home-stats-row__label text-[11px] font-bold uppercase tracking-[0.14em] text-(--color-fg-mute)"
				>
					{allDone ? 'День закрыт' : 'Выполнено сегодня'}
				</p>
				<p
					class="font-display text-2xl font-semibold uppercase leading-[1.05] tracking-wide sm:text-[1.75rem]"
				>
					{#if allDone}
						Полный день!
					{:else}
						Ещё {remaining} до полного дня
					{/if}
				</p>
				<div class="mt-0.5 flex items-center gap-1.5" aria-hidden="true">
					{#each HABIT_ORDER as h (h)}
						<span
							class="h-1.5 w-6 rounded-full"
							style="background: {habitColorVar(h)}; opacity: {done(h) ? 1 : 0.28};"
						></span>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<section class="flex flex-col" aria-label="Привычки">
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

	<section id="activity" class="scroll-mt-4" aria-label="Активность">
		<HabitHeatmap
			completions={habitsStore.completions}
			cellSize={10}
			cellGap={2}
			sectionClass="rounded-2xl p-3 sm:rounded-3xl sm:p-4"
			onDayClick={openHabitDay}
		/>
	</section>
</div>
