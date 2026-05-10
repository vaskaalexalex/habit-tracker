<script lang="ts">
	import { cardioStore } from '$stores/cardio.svelte';
	import { ensureSportCompleted } from '$stores/auto-complete';
	import { toasts } from '$stores/toast.svelte';
	import { isoToday } from '$utils/dates';
	import { Loader2 } from 'lucide-svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import CardioHeatmap from '$components/CardioHeatmap.svelte';
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

	function hasWarmupToday(): boolean {
		const d = isoToday();
		return cardioStore.items.some((c) => c.date === d && c.type === 'warmup');
	}

	async function submit(event: Event) {
		event.preventDefault();
		if (saving) return;
		if (
			type === 'warmup' &&
			hasWarmupToday() &&
			!confirm('Уже есть зарядка за сегодня. Добавить ещё одну?')
		) {
			return;
		}
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

<div class="page-shell">
	<PageHeader
		kicker="Кардио"
		title="Другая активность"
		subtitle="Запиши активность за сегодня"
	/>

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

	<section aria-label="Активность кардио">
		<CardioHeatmap
			items={cardioStore.items}
			cellSize={10}
			cellGap={2}
			sectionClass="rounded-2xl p-3 sm:rounded-3xl sm:p-4"
		/>
	</section>
</div>

<style>
	.bg-mute {
		background: var(--color-bg-mute);
	}
	.bg-soft {
		background: var(--color-accent-soft);
	}
</style>
