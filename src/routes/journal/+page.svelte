<script lang="ts">
	import { journalStore } from '$stores/journal.svelte';
	import { habitsStore } from '$stores/habits.svelte';
	import { ensureJournalCompleted } from '$stores/auto-complete';
	import JournalEditor from '$components/JournalEditor.svelte';
	import JournalHeatmap from '$components/JournalHeatmap.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { todayStore } from '$stores/today.svelte';
	import { dayHeadKicker, formatRu } from '$utils/dates';
	import { dayScopeLabel, resolveViewDate, withViewDate } from '$lib/nav/view-date';

	const today = $derived(todayStore.today);
	const viewDate = $derived(resolveViewDate($page.url.searchParams, today));
	const headKicker = $derived(dayHeadKicker(viewDate, today));

	const entryForView = $derived(journalStore.getByDate(viewDate) ?? null);
	let loading = $state(false);

	$effect(() => {
		const raw = $page.url.searchParams.get('date');
		if (raw && raw === today) {
			void goto(`${base}/journal`, { replaceState: true, keepFocus: true, noScroll: true });
		}
	});

	$effect(() => {
		const date = viewDate;
		if (!date) return;
		const local = journalStore.getByDate(date);
		if (local) {
			loading = false;
			return;
		}
		loading = true;
		void journalStore.loadDay(date).finally(() => {
			loading = false;
		});
	});

	async function handleSave({ content, mood }: { content: string; mood: number | null }) {
		await journalStore.upsertDay({ date: viewDate, content, mood });
		if (content.trim().length > 0) await ensureJournalCompleted(viewDate);
		else await habitsStore.markUndone('journal', viewDate);
	}

	async function handleClear() {
		await journalStore.deleteDay(viewDate);
		await habitsStore.markUndone('journal', viewDate);
	}

	function openJournalDay(date: string) {
		const href = withViewDate(`${base}/journal`, date, today);
		const cur = `${$page.url.pathname}${$page.url.search}`;
		if (cur === href) return;
		void goto(href, { keepFocus: true, noScroll: true });
	}
</script>

<div class="page-shell">
	<PageHeader
		kicker={headKicker}
		title="Дневник"
		subtitle="{dayScopeLabel(viewDate, today)} — {formatRu(viewDate, 'd MMMM')}"
	/>

	{#if loading}
		<div
			class="hairline rounded-3xl bg-(--color-bg-soft) p-6 text-center text-sm text-(--color-fg-mute)"
		>
			Загружаем…
		</div>
	{:else}
		<JournalEditor date={viewDate} initial={entryForView} onsave={handleSave} onclear={handleClear} />
	{/if}

	<section aria-label="Активность записей по дням">
		<JournalHeatmap
			entries={journalStore.entries}
			cellSize={10}
			cellGap={2}
			sectionClass="rounded-2xl p-3 sm:rounded-3xl sm:p-4"
			onDayClick={openJournalDay}
		/>
	</section>
</div>
