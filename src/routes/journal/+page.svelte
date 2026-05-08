<script lang="ts">
	import { journalStore } from '$stores/journal.svelte';
	import { ensureJournalCompleted } from '$stores/auto-complete';
	import JournalEditor from '$components/JournalEditor.svelte';
	import HabitHeatmap from '$components/HabitHeatmap.svelte';
	import BackButton from '$components/BackButton.svelte';
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

<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 sm:pt-10">
	<header class="flex items-center gap-2">
		<BackButton fallback="/" />
		<div class="min-w-0 flex-1">
			<p class="text-xs font-bold uppercase tracking-wider text-(--color-accent)">Записки</p>
			<h1 class="mt-0.5 text-2xl font-black tracking-tight">Дневник</h1>
			<p class="mt-1 text-sm font-medium text-(--color-fg-mute)">
				Сегодня — {formatRu(today, 'd MMMM')}
			</p>
		</div>
	</header>

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
