<script lang="ts">
	import { journalStore } from '$stores/journal.svelte';
	import { ensureJournalCompleted } from '$stores/auto-complete';
	import JournalEditor from '$components/JournalEditor.svelte';
	import HabitHeatmap from '$components/HabitHeatmap.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { todayStore } from '$stores/today.svelte';
	import { formatRu } from '$utils/dates';

	const today = $derived(todayStore.today);
	const todayEntry = $derived(journalStore.getByDate(today) ?? null);

	async function handleSave({ content, mood }: { content: string; mood: number | null }) {
		if (content.trim().length === 0 && mood === null) return;
		await journalStore.upsertDay({ date: today, content, mood });
		await ensureJournalCompleted();
	}

	function openJournalDay(date: string) {
		void goto(`${base}/journal/${date}`);
	}
</script>

<div class="page-shell">
	<PageHeader
		backFallback="/"
		kicker="Записки"
		title="Дневник"
		subtitle="Сегодня — {formatRu(today, 'd MMMM')}"
	/>

	<JournalEditor date={today} initial={todayEntry} onsave={handleSave} />

	<section aria-label="Активность записей по дням">
		<HabitHeatmap
			variant="journal"
			journalEntries={journalStore.entries}
			months={6}
			cellSize={10}
			cellGap={2}
			sectionClass="rounded-2xl p-3 sm:rounded-3xl sm:p-4"
			onJournalDayClick={openJournalDay}
		/>
	</section>
</div>
