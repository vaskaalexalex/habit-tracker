<script lang="ts">
	import { Check } from 'lucide-svelte';
	import { HABIT_ORDER } from '$supabase/types';
	import type { HabitType } from '$supabase/types';

	interface Props {
		completed: ReadonlySet<HabitType>;
		size?: number;
	}

	let { completed, size = 96 }: Props = $props();

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
	const ARC_PX = (C * SEG_DEG) / 360;

	const doneCount = $derived(HABIT_ORDER.filter((h) => completed.has(h)).length);
	const allDone = $derived(doneCount === HABIT_ORDER.length);
</script>

<div class="relative" style="width:{size}px;height:{size}px">
	<svg viewBox="0 0 100 100" width={size} height={size} class="block -rotate-90">
		{#if allDone}
			<circle cx="50" cy="50" r={RADIUS + STROKE / 2 - 1} fill="rgb(34, 197, 94)" />
		{:else}
			{#each HABIT_ORDER as habit, i (habit)}
				<circle
					cx="50"
					cy="50"
					r={RADIUS}
					fill="none"
					stroke={completed.has(habit) ? COLORS[habit] : 'var(--color-bg-mute)'}
					stroke-width={STROKE}
					stroke-dasharray="{ARC_PX} {C}"
					stroke-linecap="round"
					transform="rotate({i * 90 + GAP_DEG / 2} 50 50)"
					opacity={completed.has(habit) ? 1 : 0.55}
				/>
			{/each}
		{/if}
	</svg>

	<div class="pointer-events-none absolute inset-0 grid place-items-center">
		{#if allDone}
			<Check size={Math.round(size * 0.42)} class="text-white" strokeWidth={3} />
		{:else}
			<div class="text-center leading-none">
				<div class="text-2xl font-semibold tabular-nums">{doneCount}</div>
				<div class="text-[10px] text-(--color-fg-mute)">из {HABIT_ORDER.length}</div>
			</div>
		{/if}
	</div>
</div>
