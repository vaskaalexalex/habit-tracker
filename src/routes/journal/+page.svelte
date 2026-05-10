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
	import { isSamePathname } from '$lib/nav/same-pathname';
	import { todayStore } from '$stores/today.svelte';
	import { formatRu } from '$utils/dates';

	const today = $derived(todayStore.today);
	const todayEntry = $derived(journalStore.getByDate(today) ?? null);

	async function handleSave({ content, mood }: { content: string; mood: number | null }) {
		await journalStore.upsertDay({ date: today, content, mood });
		if (content.trim().length > 0) await ensureJournalCompleted(today);
		else await habitsStore.markUndone('journal', today);
	}

	async function handleClear() {
		await journalStore.deleteDay(today);
		await habitsStore.markUndone('journal', today);
	}

	function openJournalDay(date: string) {
		const href = `${base}/journal/${date}`;
		if (isSamePathname($page.url.pathname, href)) return;
		void goto(href);
	}
</script>

<div class="page-shell">
	<PageHeader
		kicker="Записки"
		title="Дневник"
		subtitle="Сегодня — {formatRu(today, 'd MMMM')}"
	/>

	<JournalEditor date={today} initial={todayEntry} onsave={handleSave} onclear={handleClear} />

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
