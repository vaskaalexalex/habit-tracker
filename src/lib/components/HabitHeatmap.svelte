<script lang="ts">
	import {
		eachDayOfInterval,
		endOfMonth,
		endOfYear,
		format,
		parseISO,
		setYear,
		startOfMonth,
		startOfYear
	} from 'date-fns';
	import { ru } from 'date-fns/locale';
	import { untrack } from 'svelte';
	import type { HabitCompletion } from '$supabase/types';
	import { HABIT_LABELS, HABIT_ORDER } from '$supabase/types';
	import { lastNMonthsRange, toISO } from '$utils/dates';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		completions: HabitCompletion[];
		months?: number;
	}

	let { completions, months = 6 }: Props = $props();

	type Period = 'month' | '6m' | 'year';
	const PERIOD_MONTHS: Record<Period, number> = { month: 1, '6m': 6, year: 12 };
	const PERIOD_LABEL: Record<Period, string> = { month: 'Месяц', '6m': '6 мес', year: 'Год' };
	const PERIOD_ORDER: Period[] = ['month', '6m', 'year'];

	function monthsToPeriod(n: number): Period {
		if (n <= 1) return 'month';
		if (n >= 12) return 'year';
		return '6m';
	}

	let period = $state<Period>(untrack(() => monthsToPeriod(months)));
	const periodMonths = $derived(PERIOD_MONTHS[period]);

	const currentYear = new Date().getFullYear();
	let year = $state<number>(currentYear);

	const yearOptions = $derived.by(() => {
		const set = new Set<number>([currentYear]);
		for (const c of completions) {
			const y = parseInt(c.date.slice(0, 4), 10);
			if (!Number.isNaN(y)) set.add(y);
		}
		return [...set].sort((a, b) => b - a);
	});

	const minYear = $derived(yearOptions.length > 0 ? yearOptions[yearOptions.length - 1]! : currentYear);

	const range = $derived.by(() => {
		if (period === 'year') {
			const ref = setYear(new Date(), year);
			return { from: startOfYear(ref), to: endOfYear(ref) };
		}
		if (period === 'month') {
			const ref = new Date();
			return { from: startOfMonth(ref), to: endOfMonth(ref) };
		}
		return lastNMonthsRange(periodMonths);
	});
	const days = $derived(eachDayOfInterval({ start: range.from, end: range.to }));
	const startDow = $derived((range.from.getDay() + 6) % 7);
	const totalCols = $derived(Math.ceil((days.length + startDow) / 7));

	const counts = $derived.by(() => {
		const map = new Map<string, Set<string>>();
		for (const c of completions) {
			const set = map.get(c.date) ?? new Set<string>();
			set.add(c.habit_type);
			map.set(c.date, set);
		}
		return map;
	});

	const MIN_CELL = 8;
	const MAX_CELL = 18;
	const cellGap = 3;
	const headerH = 18;
	const ROW_LABEL_W = 22;

	let containerWidth = $state(0);

	const cellSize = $derived.by(() => {
		if (containerWidth <= 0 || totalCols <= 0) return 12;
		const avail = containerWidth - ROW_LABEL_W;
		const raw = (avail - (totalCols - 1) * cellGap) / totalCols;
		return Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(raw)));
	});

	const SHADES = [
		'var(--color-bg-mute)',
		'rgba(34, 197, 94, 0.28)',
		'rgba(34, 197, 94, 0.5)',
		'rgba(34, 197, 94, 0.75)',
		'rgb(34, 197, 94)'
	];

	function level(iso: string): number {
		return counts.get(iso)?.size ?? 0;
	}

	function doneList(iso: string): string[] {
		const set = counts.get(iso);
		if (!set || set.size === 0) return [];
		return HABIT_ORDER.filter((h) => set.has(h)).map((h) => HABIT_LABELS[h]);
	}

	const monthMarkers = $derived.by(() => {
		const markers: Array<{ x: number; label: string }> = [];
		let lastMonth = -1;
		for (let i = 0; i < days.length; i++) {
			const d = days[i];
			if (!d) continue;
			const m = d.getMonth();
			if (m !== lastMonth) {
				const slot = i + startDow;
				const col = Math.floor(slot / 7);
				markers.push({ x: col * (cellSize + cellGap), label: format(d, 'LLL', { locale: ru }) });
				lastMonth = m;
			}
		}
		return markers;
	});

	const ROW_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

	let wrapperEl: HTMLDivElement | undefined = $state();
	let hover = $state<{ iso: string; x: number; y: number } | null>(null);

	function showTooltip(iso: string, ev: Event) {
		const target = ev.currentTarget;
		if (!(target instanceof SVGRectElement) || !wrapperEl) return;
		const r = target.getBoundingClientRect();
		const w = wrapperEl.getBoundingClientRect();
		hover = {
			iso,
			x: r.left - w.left + r.width / 2,
			y: r.top - w.top
		};
	}

	function hideTooltip() {
		hover = null;
	}

	const hoverDate = $derived(hover ? format(parseISO(hover.iso), 'd MMMM yyyy', { locale: ru }) : '');
	const hoverDone = $derived(hover ? doneList(hover.iso) : []);
</script>

<div class="hairline rounded-3xl bg-(--color-bg-soft) p-4">
	<div class="mb-3 flex flex-col gap-2">
		<h3 class="text-sm font-medium">Активность</h3>

		<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
			<div class="flex shrink-0 items-center gap-1.5 text-[10px] text-(--color-fg-mute)">
				<span>0</span>
				{#each SHADES as shade, i (i)}
					<span class="size-2.5 rounded-[2px]" style="background: {shade}"></span>
				{/each}
				<span>4</span>
			</div>

			<div class="hairline flex shrink-0 rounded-xl bg-(--color-bg-mute) p-0.5 text-[11px] leading-none">
				{#each PERIOD_ORDER as p (p)}
					<button
						type="button"
						onclick={() => (period = p)}
						class="rounded-lg px-2 py-1 transition active:scale-95 sm:px-2.5 sm:py-1"
						class:active={period === p}
						aria-pressed={period === p}
					>
						{PERIOD_LABEL[p]}
					</button>
				{/each}
			</div>

			{#if period === 'year'}
				<div
					class="hairline flex basis-full shrink-0 items-center justify-end rounded-xl bg-(--color-bg-mute) p-0.5 text-[11px] sm:basis-auto sm:justify-start"
				>
					<button
						type="button"
						onclick={() => (year = Math.max(minYear, year - 1))}
						class="grid size-6 place-items-center rounded-lg hover:bg-(--color-bg-soft) disabled:opacity-30 sm:size-7"
						disabled={year <= minYear}
						aria-label="Предыдущий год"
					>
						<ChevronLeft size={12} />
					</button>
					<span class="min-w-[2.5rem] px-1 text-center font-medium tabular-nums sm:min-w-0 sm:px-2">{year}</span>
					<button
						type="button"
						onclick={() => (year = Math.min(currentYear, year + 1))}
						class="grid size-6 place-items-center rounded-lg hover:bg-(--color-bg-soft) disabled:opacity-30 sm:size-7"
						disabled={year >= currentYear}
						aria-label="Следующий год"
					>
						<ChevronRight size={12} />
					</button>
				</div>
			{/if}
		</div>
	</div>

	<div class="relative" bind:this={wrapperEl} bind:clientWidth={containerWidth}>
		<div class="overflow-x-auto">
			<svg
				width={ROW_LABEL_W + totalCols * (cellSize + cellGap) - cellGap}
				height={headerH + 7 * (cellSize + cellGap) - cellGap}
				class="block"
				role="img"
				aria-label="Активность привычек"
			>
			<g transform="translate({ROW_LABEL_W}, 12)">
				{#each monthMarkers as m, i (i)}
					<text x={m.x} y={0} class="fill-(--color-fg-mute)" font-size="10">
						{m.label}
					</text>
				{/each}
			</g>

			<g transform="translate(0, {headerH})">
				{#each ROW_LABELS as label, row (row)}
					{#if label}
						<text
							x={0}
							y={row * (cellSize + cellGap) + cellSize * 0.75}
							class="fill-(--color-fg-mute)"
							font-size="9"
						>
							{label}
						</text>
					{/if}
				{/each}
			</g>

			<g transform="translate({ROW_LABEL_W}, {headerH})">
				{#each days as day, i (i)}
					{@const slot = i + startDow}
					{@const col = Math.floor(slot / 7)}
					{@const row = slot % 7}
					{@const iso = toISO(day)}
					{@const lvl = level(iso)}
					<rect
						x={col * (cellSize + cellGap)}
						y={row * (cellSize + cellGap)}
						width={cellSize}
						height={cellSize}
						rx={2.5}
						ry={2.5}
						fill={SHADES[lvl]}
						role="img"
						aria-label={iso}
						class="cell"
						class:active={hover?.iso === iso}
						onpointerenter={(e) => showTooltip(iso, e)}
						onpointerleave={hideTooltip}
						onpointercancel={hideTooltip}
					/>
				{/each}
			</g>
		</svg>
		</div>

		{#if hover}
			<div
				class="hairline pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-(--color-bg) px-2.5 py-1.5 text-xs shadow-lg"
				style="left: {hover.x}px; top: {hover.y - 6}px;"
				role="tooltip"
			>
				<p class="font-medium tabular-nums">{hoverDate}</p>
				{#if hoverDone.length === 0}
					<p class="text-(--color-fg-mute)">без отметок</p>
				{:else}
					<p class="text-(--color-fg-mute)">
						{hoverDone.join(', ')}
						<span class="text-(--color-fg)">({hoverDone.length}/4)</span>
					</p>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.cell {
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.cell:hover,
	.cell.active {
		filter: brightness(1.2);
		stroke: var(--color-fg);
		stroke-width: 1;
	}

	button.active {
		background: var(--color-bg-soft);
		color: var(--color-fg);
		font-weight: 500;
	}
</style>
