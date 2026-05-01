<script lang="ts">
	import { journalStore } from '$stores/journal.svelte';
	import { ensureJournalCompleted } from '$stores/auto-complete';
	import JournalEditor from '$components/JournalEditor.svelte';
	import BackButton from '$components/BackButton.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { todayStore } from '$stores/today.svelte';
	import { formatRu } from '$utils/dates';

	const today = $derived(todayStore.today);
	const todayEntry = $derived(journalStore.getByDate(today) ?? null);
	const past = $derived(journalStore.entries.filter((e) => e.date !== today));

	async function handleSave({ content, mood }: { content: string; mood: number | null }) {
		if (content.trim().length === 0 && mood === null) return;
		await journalStore.upsertDay({ date: today, content, mood });
		await ensureJournalCompleted();
	}

	function openEntry(event: MouseEvent, date: string) {
		event.preventDefault();
		void goto(`${base}/journal/${date}`);
	}
</script>

<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 sm:pt-10">
	<header class="flex items-center gap-2">
		<BackButton fallback="/" />
		<div class="min-w-0 flex-1">
			<h1 class="text-2xl font-semibold tracking-tight">Дневник</h1>
			<p class="text-sm text-(--color-fg-mute)">Сегодня — {formatRu(today, 'd MMMM')}</p>
		</div>
	</header>

	<JournalEditor date={today} initial={todayEntry} onsave={handleSave} />

	<section>
		<h2 class="mb-2 px-1 text-sm font-medium text-(--color-fg-mute)">Прошлые дни</h2>
		{#if past.length === 0}
			<p
				class="hairline rounded-2xl border-dashed bg-transparent p-6 text-center text-sm text-(--color-fg-mute)"
			>
				Пока ничего нет. Начни сегодня.
			</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each past as entry (entry.id)}
					<li>
						<a
							href={`${base}/journal/${entry.date}`}
							onclick={(event) => openEntry(event, entry.date)}
							class="hairline flex flex-col gap-1.5 rounded-2xl bg-(--color-bg-soft) p-3 active:scale-[0.99]"
						>
							<div class="flex items-center justify-between text-xs">
								<span class="font-medium">{formatRu(entry.date)}</span>
								{#if entry.mood != null}
									<span
										class="inline-flex items-center gap-0.5 rounded-full bg-(--color-accent-soft) px-2 py-0.5 text-[11px] font-semibold tabular-nums text-(--color-accent)"
									>
										{entry.mood}<span class="text-(--color-fg-mute)">/10</span>
									</span>
								{/if}
							</div>
							<p class="line-clamp-3 text-sm text-(--color-fg-soft)">
								{entry.content || '—'}
							</p>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
