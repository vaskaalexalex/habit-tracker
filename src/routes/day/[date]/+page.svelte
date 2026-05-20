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
	import DashboardHabitTile from '$components/DashboardHabitTile.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import { HABIT_ORDER } from '$supabase/types';
	import type { HabitType } from '$supabase/types';
	import { formatRu } from '$utils/dates';

	const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

	const date = $derived($page.params.date ?? '');
	const isValidDate = $derived(ISO_RE.test(date));

	const journalEntry = $derived(isValidDate ? journalStore.getByDate(date) : undefined);

	$effect(() => {
		if (!isValidDate) return;
		void journalStore.entries;
		void habitsStore.completions;
		void reconcileJournalCompletions();
	});

	function handle(habit: HabitType) {
		if (!isValidDate) return;
		if (habit === 'sport') {
			const hasStrength = strengthStore.setsForDate(date).length > 0;
			const hasCardio = cardioStore.items.some((c) => c.date === date);
			const href =
				hasStrength && !hasCardio
					? `${base}/sport/strength/${date}`
					: !hasStrength && hasCardio
						? `${base}/sport/cardio`
						: hasStrength
							? `${base}/sport/strength/${date}`
							: `${base}/sport`;
			if (!isSamePathname($page.url.pathname, href)) void goto(href);
			return;
		}
		if (habit === 'journal') {
			const href = `${base}/journal/${date}`;
			if (!isSamePathname($page.url.pathname, href)) void goto(href);
			return;
		}
		void habitsStore.toggle(habit, date);
	}

	const completedOnDay = $derived.by(() => {
		if (!isValidDate) return new Set<HabitType>();
		void journalStore.entries;
		void journalStore.loaded;
		void habitsStore.completions;
		void journalEntry;
		const set = new Set<HabitType>();
		for (const h of HABIT_ORDER) {
			if (h === 'journal') {
				if (
					habitsStore.isCompleted('journal', date) &&
					journalHabitBackedByWriting(journalEntry)
				) {
					set.add(h);
				}
				continue;
			}
			if (habitsStore.isCompleted(h, date)) set.add(h);
		}
		return set;
	});

	function done(h: HabitType): boolean {
		return completedOnDay.has(h);
	}
</script>

<div class="page-shell">
	<PageHeader
		kicker="День"
		title={isValidDate ? formatRu(date, 'EEEE, d MMMM yyyy') : 'Некорректная дата'}
		meta={isValidDate ? date : undefined}
	/>

	{#if !isValidDate}
		<section
			class="hairline rounded-3xl bg-(--color-bg-soft) p-4 text-sm text-(--color-fg-mute)"
		>
			Некорректный формат даты. Ожидается <code>YYYY-MM-DD</code>.
		</section>
	{:else}
		<section class="flex min-h-0 flex-col" aria-label="Привычки за день">
			<h2
				class="mb-2 text-[9px] font-bold uppercase tracking-wider text-(--color-fg-mute) sm:text-[10px]"
			>
				Привычки
			</h2>
			<div class="grid grid-cols-2 gap-2 sm:gap-3">
				{#each HABIT_ORDER as habit (habit)}
					<DashboardHabitTile
						{habit}
						completed={done(habit)}
						streak={habitsStore.streak(habit, date)}
						size="compact"
						flipVisualOnClick={habit === 'coding' || habit === 'reading'}
						onclick={() => handle(habit)}
					/>
				{/each}
			</div>
		</section>
	{/if}
</div>

