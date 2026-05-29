<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { cardioStore } from '$stores/cardio.svelte';
	import { ensureSportCompleted } from '$stores/auto-complete';
	import { toasts } from '$stores/toast.svelte';
	import { Loader2, Trash2 } from 'lucide-svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import CardioHeatmap from '$components/CardioHeatmap.svelte';
	import { CARDIO_LABELS, CARDIO_ORDER, CARDIO_NO_DISTANCE } from '$supabase/types';
	import type { CardioType, UUID } from '$supabase/types';
	import { todayStore } from '$stores/today.svelte';
	import { dayHeadKicker, formatRu } from '$utils/dates';
	import { dayScopeLabel, resolveViewDate, withViewDate } from '$lib/nav/view-date';

	const DURATION_WARMUP_DEFAULT = 10;
	const DURATION_OTHER_DEFAULT = 30;
	const DURATION_TABLE_TENNIS_DEFAULT = 60;

	const today = $derived(todayStore.today);
	const viewDate = $derived(resolveViewDate($page.url.searchParams, today));
	const headKicker = $derived(dayHeadKicker(viewDate, today));

	$effect(() => {
		const raw = $page.url.searchParams.get('date');
		if (raw && raw === today) {
			void goto(`${base}/sport/cardio`, { replaceState: true, keepFocus: true, noScroll: true });
		}
	});

	let type = $state<CardioType>('warmup');
	let duration = $state<number>(DURATION_WARMUP_DEFAULT);
	let distance = $state<number | null>(null);
	let note = $state('');
	let saving = $state(false);

	const hasDistance = $derived(!CARDIO_NO_DISTANCE.has(type));
	const minDuration = $derived(type === 'table_tennis' ? DURATION_TABLE_TENNIS_DEFAULT : 1);

	const dayItems = $derived(
		cardioStore.items
			.filter((c) => c.date === viewDate)
			.sort((a, b) => b.created_at.localeCompare(a.created_at))
	);

	async function removeItem(id: UUID, label: string) {
		if (!confirm(`Удалить запись «${label}»?`)) return;
		await cardioStore.remove(id);
		toasts.success('Удалено');
	}

	$effect(() => {
		if (!hasDistance && distance !== null) distance = null;
	});

	function selectCardioType(t: CardioType) {
		type = t;
		duration =
			t === 'warmup'
				? DURATION_WARMUP_DEFAULT
				: t === 'table_tennis'
					? DURATION_TABLE_TENNIS_DEFAULT
					: DURATION_OTHER_DEFAULT;
	}

	function hasWarmupOnDay(): boolean {
		return cardioStore.items.some((c) => c.date === viewDate && c.type === 'warmup');
	}

	async function submit(event: Event) {
		event.preventDefault();
		if (saving) return;
		if (type === 'table_tennis' && duration < DURATION_TABLE_TENNIS_DEFAULT) {
			toasts.error('Настольный теннис: минимум 60 мин');
			return;
		}
		if (
			type === 'warmup' &&
			hasWarmupOnDay() &&
			!confirm(
				viewDate === today
					? 'Уже есть зарядка за сегодня. Добавить ещё одну?'
					: `Уже есть зарядка за ${formatRu(viewDate, 'd MMMM')}. Добавить ещё одну?`
			)
		) {
			return;
		}
		saving = true;
		try {
			await cardioStore.add({
				type,
				duration_min: duration,
				distance_km: hasDistance ? distance : null,
				note: note.trim() || null,
				date: viewDate
			});
			await ensureSportCompleted(viewDate);
			note = '';
			distance = null;
			toasts.success('Записано');
			void goto(withViewDate(`${base}/`, viewDate, today), { replaceState: true });
		} finally {
			saving = false;
		}
	}
</script>

<div class="page-shell">
	<PageHeader
		kicker={headKicker}
		title="Другая активность"
		subtitle="Запиши активность за {dayScopeLabel(viewDate, today).toLowerCase()}"
	/>

	<form onsubmit={submit} class="hairline flex flex-col gap-3 rounded-3xl bg-(--color-bg-soft) p-4">
		<label class="flex flex-col gap-1">
			<span class="text-xs text-(--color-fg-mute)">Тип активности</span>
			<select
				value={type}
				onchange={(event) => selectCardioType(event.currentTarget.value as CardioType)}
				class="tap-target rounded-xl bg-(--color-bg-mute) px-3 py-2 outline-none"
			>
				{#each CARDIO_ORDER as t (t)}
					<option value={t}>{CARDIO_LABELS[t]}</option>
				{/each}
			</select>
		</label>
		<div class="grid gap-2" class:grid-cols-2={hasDistance}>
			<label class="flex flex-col gap-1">
				<span class="text-xs text-(--color-fg-mute)">Длительность, мин</span>
				<input
					type="number"
					inputmode="numeric"
					min={minDuration}
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

	<section
		aria-label="Тренировки за {dayScopeLabel(viewDate, today).toLowerCase()}"
		class="hairline flex flex-col gap-2 rounded-3xl bg-(--color-bg-soft) p-4"
	>
		<div class="flex items-center justify-between gap-2">
			<h2 class="text-sm font-semibold text-(--color-fg)">
				{dayScopeLabel(viewDate, today)}
			</h2>
			<span class="text-xs tabular-nums text-(--color-fg-mute)">
				{dayItems.length}
				{dayItems.length === 1 ? 'тренировка' : 'тренировок'}
			</span>
		</div>

		{#if dayItems.length === 0}
			<p class="py-2 text-sm text-(--color-fg-mute)">Пока ничего не записано</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each dayItems as item (item.id)}
					<li
						class="flex items-center gap-3 rounded-2xl bg-(--color-bg-mute) px-3 py-2.5"
					>
						<div class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate text-sm font-medium text-(--color-fg)">
								{CARDIO_LABELS[item.type]}
							</span>
							<span class="text-xs tabular-nums text-(--color-fg-mute)">
								{item.duration_min} мин{#if item.distance_km}
									· {item.distance_km} км{/if}{#if item.note}
									· {item.note}{/if}
							</span>
						</div>
						<button
							type="button"
							onclick={() => removeItem(item.id, CARDIO_LABELS[item.type])}
							class="grid size-9 shrink-0 place-items-center rounded-xl text-(--color-fg-mute) hover:bg-(--color-bg-soft) hover:text-rose-400 active:scale-[0.97]"
							aria-label="Удалить тренировку"
						>
							<Trash2 size={16} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section aria-label="Активность кардио">
		<CardioHeatmap
			items={cardioStore.items}
			cellSize={10}
			cellGap={2}
			sectionClass="rounded-2xl p-3 sm:rounded-3xl sm:p-4"
		/>
	</section>
</div>
