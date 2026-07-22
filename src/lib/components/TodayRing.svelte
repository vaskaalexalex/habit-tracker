<script lang="ts">
	import { onMount } from 'svelte';
	import { Check } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { HABIT_ORDER } from '$supabase/types';
	import type { HabitType } from '$supabase/types';

	interface Props {
		completed: ReadonlySet<HabitType>;
		size?: number;
	}

	let { completed, size = 96 }: Props = $props();

	let reduceMotion = $state(false);
	onMount(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduceMotion = mq.matches;
		const onChange = () => {
			reduceMotion = mq.matches;
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	const COLORS: Record<HabitType, string> = {
		sport: 'var(--color-sport)',
		coding: 'var(--color-coding)',
		reading: 'var(--color-reading)',
		journal: 'var(--color-journal)'
	};

	const RADIUS = 38;
	const STROKE = 10;
	const C = 2 * Math.PI * RADIUS;
	const GAP_DEG = 6;
	const SEG_DEG = 90 - GAP_DEG;
	/** Align arc i with 2×2 grid cell (TL, TR, BL, BR) vs `HABIT_ORDER` — same row-major as dashboard. */
	const RING_GRID_OFFSET_DEG = -90;
	/** After offset, BL/BR were mirrored; swap reading ↔ journal base step. */
	function ringBaseStepDeg(i: number): number {
		if (i === 2) return 3;
		if (i === 3) return 2;
		return i;
	}
	const ARC_PX = (C * SEG_DEG) / 360;

	const doneCount = $derived(HABIT_ORDER.filter((h) => completed.has(h)).length);
	const allDone = $derived(doneCount === HABIT_ORDER.length);

	const numFontPx = $derived(Math.round(size * 0.26));
	const subFontPx = $derived(Math.max(10, Math.round(size * 0.122)));
	const labelNudgeY = $derived(Math.round(size * 0.035));

	const fillR = RADIUS + STROKE / 2 - 1;

	const checkIn = $derived(
		reduceMotion ? { duration: 0 } : { duration: 300, start: 0.5, opacity: 0, easing: backOut }
	);
	const checkOut = $derived(reduceMotion ? { duration: 0 } : { duration: 160 });

	/** Non-reactive: avoids $effect loop when parent passes a new Set each render. */
	let prevCompletedSnap: Set<HabitType> | null = null;
	let sweepHabit = $state<HabitType | null>(null);

	$effect(() => {
		void reduceMotion;
		const next = new Set(completed);
		if (sweepHabit && !next.has(sweepHabit)) {
			sweepHabit = null;
		}
		if (prevCompletedSnap === null) {
			prevCompletedSnap = next;
			return;
		}
		let newly: HabitType | null = null;
		for (const h of HABIT_ORDER) {
			if (next.has(h) && !prevCompletedSnap.has(h)) {
				newly = h;
				break;
			}
		}
		if (newly && !reduceMotion) {
			sweepHabit = newly;
			const id = window.setTimeout(() => {
				sweepHabit = null;
			}, 500);
			prevCompletedSnap = next;
			return () => clearTimeout(id);
		}
		prevCompletedSnap = next;
	});
</script>

<div
	class="today-ring relative"
	class:today-ring--motion={!reduceMotion}
	class:today-ring--celebrate={allDone}
	style="width:{size}px;height:{size}px;--ring-c:{C};--ring-arc:{ARC_PX}"
>
	<svg viewBox="0 0 100 100" width={size} height={size} class="block -rotate-90">
		<g class="today-ring__arcs" class:today-ring__arcs--dim={allDone}>
			{#each HABIT_ORDER as habit, i (habit)}
				<circle
					class="today-ring__seg"
					class:today-ring__seg--sweep={sweepHabit === habit && completed.has(habit)}
					cx="50"
					cy="50"
					r={RADIUS}
					fill="none"
					stroke={completed.has(habit) ? COLORS[habit] : 'var(--color-bg-mute)'}
					stroke-width={STROKE}
					stroke-dasharray="{ARC_PX} {C}"
					stroke-linecap="round"
					transform="rotate({ringBaseStepDeg(i) * 90 + GAP_DEG / 2 + RING_GRID_OFFSET_DEG} 50 50)"
					opacity={completed.has(habit) ? 1 : 0.55}
				/>
			{/each}
		</g>
		<circle
			class="today-ring__fill pointer-events-none"
			class:today-ring__fill--on={allDone}
			cx="50"
			cy="50"
			r={fillR}
			fill="rgb(34, 197, 94)"
		/>
	</svg>

	<div class="pointer-events-none absolute inset-0 grid place-items-center">
		<div
			class="today-ring__center-num flex flex-col items-center justify-center text-center text-(--color-fg)"
			class:today-ring__center-num--hide={allDone}
			style="transform: translateY(-{labelNudgeY}px);"
		>
			<div
				class="font-display font-bold tabular-nums leading-none"
				style="font-size: {numFontPx}px;"
			>
				{doneCount}<span class="text-(--color-fg-mute)" style="font-size: 60%;"
					>/{HABIT_ORDER.length}</span
				>
			</div>
			<div
				class="mt-[0.22em] font-bold uppercase leading-none tracking-wide text-(--color-fg-mute)"
				style="font-size: {subFontPx}px;"
			>
				закрыто
			</div>
		</div>
		{#if allDone}
			<div class="today-ring__check-wrap absolute inset-0 grid place-items-center">
				<div in:scale={checkIn} out:fade={checkOut}>
					<Check size={Math.round(size * 0.42)} class="text-white" strokeWidth={3} />
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.today-ring__fill {
		opacity: 0;
		transform: scale(0.86);
		transform-origin: center;
		pointer-events: none;
	}
	.today-ring--motion .today-ring__fill {
		transition:
			opacity 0.48s cubic-bezier(0.25, 0.9, 0.35, 1),
			transform 0.52s cubic-bezier(0.25, 0.9, 0.35, 1);
	}
	.today-ring__fill--on {
		opacity: 1;
		transform: scale(1);
	}

	.today-ring__arcs {
		opacity: 1;
		transform-origin: 50px 50px;
	}
	.today-ring--motion .today-ring__arcs {
		transition:
			opacity 0.38s cubic-bezier(0.25, 0.9, 0.35, 1),
			transform 0.44s cubic-bezier(0.25, 0.9, 0.35, 1);
	}
	.today-ring__arcs--dim {
		opacity: 0;
		transform: scale(0.92);
	}

	.today-ring--motion .today-ring__seg {
		transition:
			stroke 0.48s cubic-bezier(0.33, 1, 0.68, 1),
			opacity 0.42s ease;
	}

	@keyframes today-ring-seg-sweep {
		from {
			stroke-dasharray: 0 var(--ring-c);
		}
		to {
			stroke-dasharray: var(--ring-arc) var(--ring-c);
		}
	}

	.today-ring--motion .today-ring__seg--sweep {
		animation: today-ring-seg-sweep 0.48s cubic-bezier(0.33, 1, 0.68, 1) forwards;
		transition: none;
	}

	.today-ring__center-num {
		opacity: 1;
	}
	.today-ring--motion .today-ring__center-num {
		transition: opacity 0.32s cubic-bezier(0.25, 0.9, 0.35, 1);
	}
	.today-ring__center-num--hide {
		opacity: 0;
	}

	@keyframes today-ring-celebrate {
		0% {
			transform: scale(1);
			filter: drop-shadow(0 0 0 transparent);
		}
		40% {
			transform: scale(1.07);
			filter: drop-shadow(0 0 14px rgb(34 197 94 / 0.55));
		}
		100% {
			transform: scale(1);
			filter: drop-shadow(0 0 0 transparent);
		}
	}

	.today-ring--motion.today-ring--celebrate {
		animation: today-ring-celebrate 0.68s cubic-bezier(0.25, 0.9, 0.35, 1) 1;
		transform-origin: center center;
	}

	@media (prefers-reduced-motion: reduce) {
		.today-ring__fill {
			transition: none;
		}
		.today-ring__fill:not(.today-ring__fill--on) {
			opacity: 0;
			transform: scale(0.86);
		}
		.today-ring__fill.today-ring__fill--on {
			opacity: 1;
			transform: scale(1);
		}
		.today-ring__arcs {
			transition: none;
		}
		.today-ring__arcs--dim {
			opacity: 0;
			transform: none;
		}
		.today-ring__seg {
			transition: none;
		}
		.today-ring__seg--sweep {
			animation: none;
		}
		.today-ring__center-num {
			transition: none;
		}
		.today-ring--celebrate {
			animation: none;
		}
	}
</style>
