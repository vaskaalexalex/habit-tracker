<script lang="ts">
	import { cardioStore } from '$stores/cardio.svelte';
	import { ensureSportCompleted, ensureSportNotCompletedIfEmpty } from '$stores/auto-complete';
	import { toasts } from '$stores/toast.svelte';
	import type { CardioWorkout } from '$supabase/types';
	import { Trash2, Loader2 } from 'lucide-svelte';
	import BackButton from '$components/BackButton.svelte';
	import { formatRuShort } from '$utils/dates';
	import { CARDIO_LABELS, CARDIO_ORDER, CARDIO_NO_DISTANCE } from '$supabase/types';
	import type { CardioType } from '$supabase/types';

	let type = $state<CardioType>('warmup');
	let duration = $state<number>(30);
	let distance = $state<number | null>(null);
	let note = $state('');
	let saving = $state(false);

	const hasDistance = $derived(!CARDIO_NO_DISTANCE.has(type));

	$effect(() => {
		if (!hasDistance && distance !== null) distance = null;
	});

	async function handleDelete(item: CardioWorkout) {
		await cardioStore.remove(item.id);
		await ensureSportNotCompletedIfEmpty(item.date);
	}

	async function submit(event: Event) {
		event.preventDefault();
		if (saving) return;
		saving = true;
		try {
			await cardioStore.add({
				type,
				duration_min: duration,
				distance_km: hasDistance ? distance : null,
				note: note.trim() || null
			});
			await ensureSportCompleted();
			note = '';
			distance = null;
			toasts.success('Записано');
		} finally {
			saving = false;
		}
	}
</script>

<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 sm:pt-10">
	<header class="flex items-center gap-2">
		<BackButton fallback="/sport" />
		<div class="min-w-0 flex-1">
			<p class="page-kicker">Кардио</p>
			<h1 class="mt-0.5 text-2xl font-black tracking-tight">Другая активность</h1>
		</div>
	</header>

	<form onsubmit={submit} class="hairline flex flex-col gap-3 rounded-3xl bg-(--color-bg-soft) p-4">
		<div class="flex flex-wrap gap-1.5">
			{#each CARDIO_ORDER as t (t)}
				<button
					type="button"
					onclick={() => (type = t)}
					class="tap-target rounded-xl px-3 py-1.5 text-sm transition active:scale-95"
					class:bg-mute={type !== t}
					class:bg-soft={type === t}
				>
					{CARDIO_LABELS[t]}
				</button>
			{/each}
		</div>
		<div class="grid gap-2" class:grid-cols-2={hasDistance}>
			<label class="flex flex-col gap-1">
				<span class="text-xs text-(--color-fg-mute)">Длительность, мин</span>
				<input
					type="number"
					inputmode="numeric"
					min="1"
					bind:value={duration}
					required
					class="rounded-xl bg-(--color-bg-mute) px-3 py-2 outline-none tabular-nums"
				/>
			</label>
			{#if hasDistance}
				<label class="flex flex-col gap-1">
					<span class="text-xs text-(--color-fg-mute)">Дистанция, км</span>
					<input
						type="number"
						inputmode="decimal"
						step="0.1"
						min="0"
						bind:value={distance}
						placeholder="—"
						class="rounded-xl bg-(--color-bg-mute) px-3 py-2 outline-none tabular-nums"
					/>
				</label>
			{/if}
		</div>
		<input
			bind:value={note}
			placeholder="Заметка"
			class="rounded-xl bg-(--color-bg-mute) px-3 py-2 outline-none"
		/>
		<button
			type="submit"
			disabled={saving}
			class="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-(--color-accent) px-4 py-3 text-sm font-medium text-white active:scale-[0.99] disabled:opacity-60"
		>
			{#if saving}<Loader2 size={16} class="animate-spin" />{/if}
			<span>Сохранить</span>
		</button>
	</form>

	<section>
		<h2 class="mb-2 px-1 text-sm font-medium text-(--color-fg-mute)">История</h2>
		{#if cardioStore.items.length === 0}
			<p
				class="hairline rounded-2xl border-dashed bg-transparent p-6 text-center text-sm text-(--color-fg-mute)"
			>
				Пусто. Добавь первую запись.
			</p>
		{:else}
			<ul class="hairline flex flex-col rounded-2xl bg-(--color-bg-soft)">
				{#each cardioStore.items as item (item.id)}
					<li
						class="flex items-center gap-3 px-3 py-2 not-last:border-b not-last:border-(--color-border)"
					>
						<div class="flex-1">
							<p class="font-medium">{CARDIO_LABELS[item.type]}</p>
							<p class="text-xs text-(--color-fg-mute)">
								{formatRuShort(item.date)} · {item.duration_min} мин
								{#if item.distance_km}· {item.distance_km} км{/if}
								{#if item.note}· {item.note}{/if}
							</p>
						</div>
						<button
							type="button"
							class="tap-target grid size-9 place-items-center rounded-xl text-(--color-fg-mute) hover:text-rose-400"
							onclick={() => handleDelete(item)}
							aria-label="Удалить"
						>
							<Trash2 size={16} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.bg-mute {
		background: var(--color-bg-mute);
	}
	.bg-soft {
		background: var(--color-accent-soft);
	}
	.not-last\:border-b:not(:last-child) {
		border-bottom-width: 1px;
	}
	.not-last\:border-\(--color-border\):not(:last-child) {
		border-color: var(--color-border);
	}
</style>
