<script lang="ts">
	import { page } from '$app/stores';
	import { journalStore } from '$stores/journal.svelte';
	import { ensureJournalCompleted } from '$stores/auto-complete';
	import JournalEditor from '$components/JournalEditor.svelte';
	import BackButton from '$components/BackButton.svelte';
	import { formatRu } from '$utils/dates';

	const date = $derived($page.params.date ?? '');
	const entry = $derived(date ? (journalStore.getByDate(date) ?? null) : null);
	let loading = $state(true);

	$effect(() => {
		if (date) {
			loading = true;
			void journalStore.loadDay(date).finally(() => {
				loading = false;
			});
		}
	});

	async function handleSave({ content, mood }: { content: string; mood: number | null }) {
		await journalStore.upsertDay({ date, content, mood });
		await ensureJournalCompleted(date);
	}
</script>

<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 sm:pt-10">
	<header class="flex items-center gap-2">
		<BackButton fallback="/journal" />
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">
				{date ? formatRu(date) : '—'}
			</h1>
			<p class="text-sm text-(--color-fg-mute)">{date}</p>
		</div>
	</header>

	{#if loading}
		<div
			class="hairline rounded-3xl bg-(--color-bg-soft) p-6 text-center text-sm text-(--color-fg-mute)"
		>
			Загружаем…
		</div>
	{:else if date}
		<JournalEditor {date} initial={entry} onsave={handleSave} />
	{/if}
</div>
