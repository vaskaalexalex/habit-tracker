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
	import { onMount } from 'svelte';
	import type { HabitCompletion, ISODate, JournalEntry } from '$supabase/types';
	import { HABIT_LABELS, HABIT_ORDER } from '$supabase/types';
	import { lastNMonthsRange, toISO } from '$utils/dates';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		/** Привычки (главная). В режиме journal не используется. */
		completions?: HabitCompletion[];
		/** `journal` — интенсивность по записям дневника, клик по дню. */
		variant?: 'habits' | 'journal';
		journalEntries?: JournalEntry[];
		onJournalDayClick?: (date: ISODate) => void;
		months?: number;
		/** Ширина ячейки дня (px). По умолчанию как в проде. */
		cellSize?: number;
		/** Зазор между ячейками (px). */
		cellGap?: number;
		/** Дополнительные классы корневой карточки (превью / вложенный режим). */
		sectionClass?: string;
	}

	let {
		completions = [],
		variant = 'habits',
		journalEntries = [],
		onJournalDayClick,
		months = 6,
		cellSize = 12,
		cellGap = 3,
		sectionClass = ''
	}: Props = $props();

	function journalActivityLevel(e: JournalEntry): number {
		const text = e.content.trim();
		if (text.length === 0 && e.mood == null) return 0;
		if (e.mood != null) {
			const m = e.mood;
			if (m <= 2) return 1;
			if (m <= 5) return 2;
			if (m <= 7) return 3;
			return 4;
		}
		return 2;
	}

	const journalLevels = $derived.by(() => {
		const map = new Map<string, number>();
		if (variant !== 'journal') return map;
		for (const e of journalEntries) {
			map.set(e.date, journalActivityLevel(e));
		}
		return map;
	});

	const journalByDate = $derived.by(() => {
		const map = new Map<string, JournalEntry>();
		for (const e of journalEntries) map.set(e.date, e);
		return map;
	});

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
		if (variant === 'journal') {
			for (const e of journalEntries) {
				const y = parseInt(e.date.slice(0, 4), 10);
				if (!Number.isNaN(y)) set.add(y);
			}
		} else {
			for (const c of completions) {
				const y = parseInt(c.date.slice(0, 4), 10);
				if (!Number.isNaN(y)) set.add(y);
			}
		}
		return [...set].sort((a, b) => b - a);
	});

	const minYear = $derived(
		yearOptions.length > 0 ? yearOptions[yearOptions.length - 1]! : currentYear
	);

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

	const headerH = 18;
	const ROW_LABEL_W = 22;

	const SHADES = [
		'var(--color-bg-mute)',
		'rgba(34, 197, 94, 0.28)',
		'rgba(34, 197, 94, 0.5)',
		'rgba(34, 197, 94, 0.75)',
		'rgb(34, 197, 94)'
	];

	function level(iso: string): number {
		if (variant === 'journal') return journalLevels.get(iso) ?? 0;
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

	/** Viewport snapshot of hovered cell for fixed-position tooltip (not tied to scroll parent). */
	type CellAnchor = {
		iso: string;
		left: number;
		top: number;
		right: number;
		bottom: number;
		width: number;
		height: number;
	};

	let hover = $state<CellAnchor | null>(null);
	let tooltipEl: HTMLDivElement | undefined = $state();
	let cardRootEl: HTMLDivElement | undefined = $state();
	/** Primary input cannot hover (phones): tap pins tooltip; journal day opens on second tap. */
	let touchTooltipMode = $state(false);
	/** Latest values for document/scroll listeners registered in onMount (avoid stale closures). */
	const pointerUiRef = { touch: false, hover: null as CellAnchor | null };
	$effect(() => {
		pointerUiRef.touch = touchTooltipMode;
		pointerUiRef.hover = hover;
	});
	/** `position:fixed` coords after clamping into visual viewport */
	let tooltipFixed = $state<{ left: number; top: number } | null>(null);

	let hideHoverTimer: ReturnType<typeof setTimeout> | null = null;

	function clearHideHoverTimer() {
		if (hideHoverTimer != null) {
			clearTimeout(hideHoverTimer);
			hideHoverTimer = null;
		}
	}

	function hideHoverNow() {
		clearHideHoverTimer();
		hover = null;
		tooltipFixed = null;
	}

	/** Delay so pointer can move onto the fixed tooltip (scroll long journal text). */
	function scheduleHideHover() {
		clearHideHoverTimer();
		hideHoverTimer = setTimeout(() => {
			hideHoverTimer = null;
			hover = null;
			tooltipFixed = null;
		}, 220);
	}

	function rectToAnchor(iso: string, r: DOMRect): CellAnchor {
		return {
			iso,
			left: r.left,
			top: r.top,
			right: r.right,
			bottom: r.bottom,
			width: r.width,
			height: r.height
		};
	}

	function showTooltip(iso: string, ev: Event) {
		clearHideHoverTimer();
		const target = ev.currentTarget;
		if (!(target instanceof SVGRectElement)) return;
		hover = rectToAnchor(iso, target.getBoundingClientRect());
	}

	function hideTooltip() {
		scheduleHideHover();
	}

	function layoutTooltip() {
		if (!hover || !tooltipEl) {
			tooltipFixed = null;
			return;
		}
		const pad = 10;
		const vv = window.visualViewport;
		const vx = vv?.offsetLeft ?? 0;
		const vy = vv?.offsetTop ?? 0;
		const vw = vv?.width ?? window.innerWidth;
		const vh = vv?.height ?? window.innerHeight;

		const tw = tooltipEl.offsetWidth;
		const th = tooltipEl.offsetHeight;
		const cx = hover.left + hover.width / 2;

		let left = cx - tw / 2;
		let top = hover.top - th - 8;

		if (top < vy + pad) {
			top = hover.bottom + 8;
		}
		if (top + th > vy + vh - pad) {
			top = vy + vh - pad - th;
		}
		if (top < vy + pad) {
			top = vy + pad;
		}

		left = Math.max(vx + pad, Math.min(left, vx + vw - pad - tw));

		tooltipFixed = { left, top };
	}

	const hoverDate = $derived(
		hover ? format(parseISO(hover.iso), 'd MMMM yyyy', { locale: ru }) : ''
	);
	const hoverDone = $derived(hover ? doneList(hover.iso) : []);

	const hoverJournalEntry = $derived(
		variant === 'journal' && hover ? (journalByDate.get(hover.iso) ?? null) : null
	);

	$effect(() => {
		if (!hover || !tooltipEl) {
			tooltipFixed = null;
			return;
		}

		let ro: ResizeObserver | undefined;
		let cancelled = false;

		const tick = () => {
			requestAnimationFrame(() => {
				if (cancelled || !tooltipEl || !hover) return;
				layoutTooltip();
				ro?.disconnect();
				ro = new ResizeObserver(() => layoutTooltip());
				ro.observe(tooltipEl);
			});
		};

		tick();

		return () => {
			cancelled = true;
			ro?.disconnect();
		};
	});

	onMount(() => {
		const mql = window.matchMedia('(hover: none)');
		const syncTouchTooltipMode = () => {
			touchTooltipMode = mql.matches;
		};
		syncTouchTooltipMode();
		mql.addEventListener('change', syncTouchTooltipMode);

		const onScrollOrResize = () => {
			if (pointerUiRef.hover) hideHoverNow();
		};
		window.addEventListener('scroll', onScrollOrResize, true);
		window.addEventListener('resize', onScrollOrResize);
		const vv = window.visualViewport;
		vv?.addEventListener('resize', onScrollOrResize);
		vv?.addEventListener('scroll', onScrollOrResize);

		const onDocPointerDown = (ev: PointerEvent) => {
			if (!pointerUiRef.touch || !pointerUiRef.hover) return;
			const root = cardRootEl;
			const t = ev.target;
			if (!(t instanceof Node) || !root?.contains(t)) hideHoverNow();
		};
		document.addEventListener('pointerdown', onDocPointerDown, true);

		return () => {
			mql.removeEventListener('change', syncTouchTooltipMode);
			clearHideHoverTimer();
			document.removeEventListener('pointerdown', onDocPointerDown, true);
			window.removeEventListener('scroll', onScrollOrResize, true);
			window.removeEventListener('resize', onScrollOrResize);
			vv?.removeEventListener('resize', onScrollOrResize);
			vv?.removeEventListener('scroll', onScrollOrResize);
		};
	});

	const gridSvgHeight = $derived(headerH + 7 * (cellSize + cellGap) - cellGap);

	const svgAriaLabel = $derived(
		variant === 'journal' ? 'Активность дневника по дням' : 'Активность привычек'
	);

	function dayCellClick(iso: string, ev: MouseEvent) {
		if (touchTooltipMode) {
			const target = ev.currentTarget;
			if (!(target instanceof SVGRectElement)) return;

			if (variant === 'journal' && onJournalDayClick) {
				if (hover?.iso === iso) {
					ev.preventDefault();
					hideHoverNow();
					onJournalDayClick(iso as ISODate);
				} else {
					showTooltip(iso, ev);
				}
				return;
			}

			if (hover?.iso === iso) {
				hideHoverNow();
			} else {
				showTooltip(iso, ev);
			}
			return;
		}

		if (variant !== 'journal' || !onJournalDayClick) return;
		ev.preventDefault();
		hideHoverNow();
		onJournalDayClick(iso as ISODate);
	}

	$effect(() => {
		void period;
		void year;
		hideHoverNow();
	});
</script>

<div
	bind:this={cardRootEl}
	class="hairline rounded-3xl bg-(--color-bg-soft) p-4 {sectionClass}"
	class:heatmap-touch-mode={touchTooltipMode}
>
	<div class="mb-3 flex flex-col gap-2">
		<h3 class="text-sm font-medium">Активность</h3>

		<div class="flex min-h-8 min-w-0 flex-nowrap items-center justify-between gap-2">
			<div
				class="hairline flex shrink-0 rounded-xl bg-(--color-bg-mute) p-0.5 text-[11px] leading-none"
			>
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

			<!-- Фиксированная ширина: переключатель года не появляется/не исчезает → блок не прыгает -->
			<div
				class="flex h-8 min-w-[7.25rem] shrink-0 items-center justify-end sm:min-w-[7.5rem]"
				aria-hidden={period !== 'year'}
			>
				{#if period === 'year'}
					<div class="hairline flex items-center rounded-xl bg-(--color-bg-mute) p-0.5 text-[11px]">
						<button
							type="button"
							onclick={() => (year = Math.max(minYear, year - 1))}
							class="grid size-6 place-items-center rounded-lg hover:bg-(--color-bg-soft) disabled:opacity-30 sm:size-7"
							disabled={year <= minYear}
							aria-label="Предыдущий год"
						>
							<ChevronLeft size={12} />
						</button>
						<span class="min-w-[2.75rem] px-1 text-center font-medium tabular-nums">{year}</span>
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
	</div>

	<div class="relative">
		<div
			class="overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable]"
			style="min-height: {gridSvgHeight}px;"
		>
			<svg
				width={ROW_LABEL_W + totalCols * (cellSize + cellGap) - cellGap}
				height={gridSvgHeight}
				class="block"
				role="img"
				aria-label={svgAriaLabel}
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
						<!-- SVG cells: pointer tooltip everywhere; journal variant navigates on tap — no native interactive role inside SVG. -->
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<rect
							x={col * (cellSize + cellGap)}
							y={row * (cellSize + cellGap)}
							width={cellSize}
							height={cellSize}
							rx={2.5}
							ry={2.5}
							fill={SHADES[lvl]}
							role="img"
							aria-label={variant === 'journal' && onJournalDayClick
								? touchTooltipMode
									? `Запись за ${iso}. Нажми ещё раз, чтобы открыть`
									: `Открыть запись за ${iso}`
								: iso}
							class="cell"
							class:cell-clickable={variant === 'journal' && !!onJournalDayClick}
							class:active={hover?.iso === iso}
							onpointerenter={touchTooltipMode ? undefined : (e) => showTooltip(iso, e)}
							onpointerleave={touchTooltipMode ? undefined : hideTooltip}
							onpointercancel={touchTooltipMode ? undefined : hideTooltip}
							onclick={(e) => dayCellClick(iso, e)}
						/>
					{/each}
				</g>
			</svg>
		</div>

		{#if hover}
			<div
				bind:this={tooltipEl}
				class="heatmap-tooltip hairline fixed z-[300] max-h-[min(28rem,calc(100dvh-1.25rem))] w-max max-w-[min(22rem,calc(100vw-1.25rem))] overflow-hidden rounded-xl bg-(--color-bg) px-2.5 py-1.5 text-xs shadow-lg"
				style:left={tooltipFixed !== null ? `${tooltipFixed.left}px` : '-9999px'}
				style:top={tooltipFixed !== null ? `${tooltipFixed.top}px` : '-9999px'}
				style:opacity={tooltipFixed !== null ? '1' : '0'}
				role="tooltip"
				onpointerenter={touchTooltipMode ? undefined : clearHideHoverTimer}
				onpointerleave={touchTooltipMode ? undefined : hideTooltip}
			>
				<p class="pointer-events-none font-medium tabular-nums">{hoverDate}</p>
				{#if variant === 'journal'}
					{#if !hoverJournalEntry || journalActivityLevel(hoverJournalEntry) === 0}
						<p class="pointer-events-none text-(--color-fg-mute)">нет записи</p>
					{:else}
						{#if hoverJournalEntry.mood != null}
							<p class="pointer-events-none text-(--color-fg-mute)">
								Настроение <span class="text-(--color-fg)">{hoverJournalEntry.mood}</span>/10
							</p>
						{/if}
						{#if hoverJournalEntry.content.trim()}
							<div
								class="pointer-events-auto mt-1 max-h-[min(240px,38vh)] overflow-y-auto overscroll-contain text-pretty break-words text-(--color-fg-soft)"
							>
								{hoverJournalEntry.content.trim()}
							</div>
						{/if}
						{#if onJournalDayClick}
							<p class="pointer-events-none mt-1 text-[10px] text-(--color-fg-mute)">
								Нажми, чтобы открыть
							</p>
						{/if}
					{/if}
				{:else if hoverDone.length === 0}
					<p class="pointer-events-none text-(--color-fg-mute)">без отметок</p>
				{:else}
					<p class="pointer-events-none break-words text-(--color-fg-mute)">
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

	.heatmap-touch-mode .cell:active {
		filter: brightness(1.15);
	}

	.cell-clickable {
		cursor: pointer;
	}

	button.active {
		background: var(--color-bg-soft);
		color: var(--color-fg);
		font-weight: 500;
	}
</style>
