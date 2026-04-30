<script lang="ts">
	import { eachDayOfInterval, endOfMonth, startOfMonth, format } from 'date-fns';
	import { ru } from 'date-fns/locale';
	import type { HabitCompletion } from '$supabase/types';
	import { HABIT_LABELS, HABIT_ORDER } from '$supabase/types';
	import { toISO } from '$utils/dates';

	interface Props {
		completions: HabitCompletion[];
		month?: Date;
	}

	let { completions, month = new Date() }: Props = $props();

	const HABIT_COLORS: Record<string, string> = {
		sport: 'var(--color-sport)',
		coding: 'var(--color-coding)',
		reading: 'var(--color-reading)',
		journal: 'var(--color-journal)'
	};

	const days = $derived(eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }));

	type Series = {
		habit: string;
		points: Array<{ x: number; y: number; iso: string; on: boolean }>;
	};

	const W = 320;
	const H = 140;
	const padding = { top: 12, right: 12, bottom: 24, left: 12 };

	const series = $derived.by<Series[]>(() => {
		const dayCount = days.length;
		const innerW = W - padding.left - padding.right;
		const innerH = H - padding.top - padding.bottom;
		return HABIT_ORDER.map((habit) => {
			const set = new Set(completions.filter((c) => c.habit_type === habit).map((c) => c.date));
			let cumulative = 0;
			const points = days.map((d, i) => {
				const iso = toISO(d);
				const on = set.has(iso);
				if (on) cumulative++;
				const x = padding.left + (dayCount === 1 ? 0 : (i / (dayCount - 1)) * innerW);
				const y = padding.top + innerH - (cumulative / Math.max(dayCount, 1)) * innerH;
				return { x, y, iso, on };
			});
			return { habit, points };
		});
	});

	function pathFor(points: Series['points']): string {
		if (points.length === 0) return '';
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
			.join(' ');
	}
</script>

<div class="hairline rounded-3xl bg-(--color-bg-soft) p-3">
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-xs font-medium text-(--color-fg-mute)">Динамика — {format(month, 'LLLL', { locale: ru })}</h3>
	</div>
	<div class="overflow-hidden">
		<svg
			viewBox="0 0 {W} {H}"
			preserveAspectRatio="none"
			class="block h-16 w-full"
			role="img"
			aria-label="Месячная динамика"
		>
			<g>
				{#each Array(4) as _, i (i)}
					<line
						x1={padding.left}
						x2={W - padding.right}
						y1={padding.top + ((H - padding.top - padding.bottom) * i) / 3}
						y2={padding.top + ((H - padding.top - padding.bottom) * i) / 3}
						stroke="var(--color-border)"
						stroke-dasharray="2 4"
					/>
				{/each}
			</g>
			{#each series as s (s.habit)}
				<path
					d={pathFor(s.points)}
					fill="none"
					stroke={HABIT_COLORS[s.habit]}
					stroke-width="2"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
			{/each}
		</svg>
	</div>
	<div class="mt-2 flex flex-wrap gap-3 text-xs text-(--color-fg-mute)">
		{#each HABIT_ORDER as h (h)}
			<span class="inline-flex items-center gap-1">
				<span class="size-2.5 rounded-full" style="background: {HABIT_COLORS[h]}"></span>
				<span>{HABIT_LABELS[h]}</span>
			</span>
		{/each}
	</div>
</div>
