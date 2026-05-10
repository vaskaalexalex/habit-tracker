<script lang="ts">
	import { page } from '$app/stores';
	import { journalStore } from '$stores/journal.svelte';
	import { habitsStore } from '$stores/habits.svelte';
	import { ensureJournalCompleted } from '$stores/auto-complete';
	import JournalEditor from '$components/JournalEditor.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import { formatRu } from '$utils/dates';

	const date = $derived($page.params.date ?? '');
	const entry = $derived(date ? (journalStore.getByDate(date) ?? null) : null);
	let loading = $state(true);

	$effect(() => {
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
		await journalStore.upsertDay({ date, content, mood });
		if (content.trim().length > 0) await ensureJournalCompleted(date);
		else await habitsStore.markUndone('journal', date);
	}

	async function handleClear() {
		await journalStore.deleteDay(date);
		await habitsStore.markUndone('journal', date);
	}
</script>

<div class="page-shell">
	<PageHeader
		kicker="День"
		title={date ? formatRu(date, 'EEEE, d MMMM yyyy') : '—'}
		meta={date ? date : undefined}
	/>

	{#if loading}
		<div
			class="hairline rounded-3xl bg-(--color-bg-soft) p-6 text-center text-sm text-(--color-fg-mute)"
		>
			Загружаем…
		</div>
	{:else if date}
		<JournalEditor {date} initial={entry} onsave={handleSave} onclear={handleClear} />
	{/if}
</div>
