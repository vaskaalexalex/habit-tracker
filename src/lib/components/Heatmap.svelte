<script lang="ts">
	import {
		eachDayOfInterval,
		endOfYear,
		format,
		parseISO,
		setYear,
		startOfYear
	} from 'date-fns';
	import { ru } from 'date-fns/locale';
	import { onMount, type Snippet } from 'svelte';
	import type { ISODate } from '$supabase/types';
	import { toISO } from '$utils/dates';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		/** Уровень закраски ячейки 0..4 по ISO-дате. Отсутствие ключа = 0. */
		levels: Map<ISODate, number>;
		/** Доступные годы для year-picker (default: [currentYear]). */
		dataYears?: number[];
		cellSize?: number;
		cellGap?: number;
		sectionClass?: string;
		title?: string;
		ariaLabel?: string;
		onDayClick?: (iso: ISODate) => void;
		tooltip?: Snippet<[{ iso: ISODate; level: number }]>;
		/** Если задан — слева в шапке счётчик «{counterLabel}: N / daysInYear». */
		counterLabel?: string;
	}

	let {
		levels,
		dataYears,
		cellSize = 12,
		cellGap = 3,
		sectionClass = '',
		title = 'Активность',
		ariaLabel = 'Активность по дням',
		onDayClick,
		tooltip,
		counterLabel
	}: Props = $props();

	const currentYear = new Date().getFullYear();
	let year = $state<number>(currentYear);

	const yearOptions = $derived.by(() => {
		const set = new Set<number>([currentYear]);
		for (const y of dataYears ?? []) set.add(y);
		return [...set].sort((a, b) => b - a);
	});
	const minYear = $derived(
		yearOptions.length > 0 ? yearOptions[yearOptions.length - 1]! : currentYear
	);

	const range = $derived.by(() => {
		const ref = setYear(new Date(), year);
		return { from: startOfYear(ref), to: endOfYear(ref) };
	});
	const days = $derived(eachDayOfInterval({ start: range.from, end: range.to }));
	const startDow = $derived((range.from.getDay() + 6) % 7);
	const totalCols = $derived(Math.ceil((days.length + startDow) / 7));

	const headerH = 18;
	const ROW_LABEL_W = 22;

	const SHADES = [
		'var(--color-bg-mute)',
		'rgba(34, 197, 94, 0.28)',
		'rgba(34, 197, 94, 0.5)',
		'rgba(34, 197, 94, 0.75)',
		'rgb(34, 197, 94)'
	];

	function levelOf(iso: string): number {
		return levels.get(iso) ?? 0;
	}

	const isLeapYear = $derived(
		(year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
	);
	const daysInYear = $derived(isLeapYear ? 366 : 365);

	const activeDaysInYear = $derived.by(() => {
		const prefix = `${year}-`;
		let n = 0;
		for (const [iso, lvl] of levels) {
			if (lvl > 0 && iso.startsWith(prefix)) n++;
		}
		return n;
	});

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
				const label = format(d, 'LLL', { locale: ru }).replace(/\.$/, '');
				markers.push({ x: col * (cellSize + cellGap), label });
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
	/** Primary input cannot hover (phones): tap pins tooltip; second tap fires onDayClick. */
	let touchTooltipMode = $state(false);
	/** Latest values for document/scroll listeners registered in onMount (avoid stale closures). */
	const pointerUiRef = { touch: false, hover: null as CellAnchor | null };
	$effect(() => {
		pointerUiRef.touch = touchTooltipMode;
		pointerUiRef.hover = hover;
	});
	/** `position:fixed` coords after clamping into visual viewport. */
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

	/** Delay so pointer can move onto the fixed tooltip (e.g. scroll long content inside). */
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

	function dayCellClick(iso: string, ev: MouseEvent) {
		if (touchTooltipMode) {
			const target = ev.currentTarget;
			if (!(target instanceof SVGRectElement)) return;

			if (onDayClick) {
				if (hover?.iso === iso) {
					ev.preventDefault();
					hideHoverNow();
					onDayClick(iso as ISODate);
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

		if (!onDayClick) return;
		ev.preventDefault();
		hideHoverNow();
		onDayClick(iso as ISODate);
	}

	$effect(() => {
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
		<h3 class="text-sm font-medium">{title}</h3>

		<div class="flex min-h-8 min-w-0 flex-nowrap items-center justify-between gap-2">
			<div class="min-w-0 shrink-0 text-[11px] text-(--color-fg-mute)">
				{#if counterLabel}
					<span>{counterLabel}: </span>
					<span class="font-semibold tabular-nums text-(--color-fg)">{activeDaysInYear}</span>
					<span class="tabular-nums"> / {daysInYear}</span>
				{/if}
			</div>

			<div class="flex h-8 shrink-0 items-center justify-end">
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
				aria-label={ariaLabel}
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
						{@const lvl = levelOf(iso)}
						<!-- SVG cells: pointer tooltip everywhere; onDayClick navigates on tap — no native interactive role inside SVG. -->
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
							aria-label={onDayClick
								? touchTooltipMode
									? `${iso}. Нажми ещё раз, чтобы открыть`
									: `Открыть ${iso}`
								: iso}
							class="cell"
							class:cell-clickable={!!onDayClick}
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
			{@const hovIso = hover.iso}
			{@const hovLvl = levelOf(hovIso)}
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
				{#if tooltip}
					{@render tooltip({ iso: hovIso as ISODate, level: hovLvl })}
				{:else}
					<p class="pointer-events-none text-(--color-fg-mute)">без отметок</p>
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
</style>
