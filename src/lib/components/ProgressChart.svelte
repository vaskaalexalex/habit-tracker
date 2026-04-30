<script lang="ts">
	import { epley1RM } from '$utils/strength';
	import { formatRuShort } from '$utils/dates';
	import type { WorkoutSet } from '$supabase/types';

	interface Props {
		sets: WorkoutSet[];
	}

	let { sets }: Props = $props();

	const data = $derived.by(() => {
		const map = new Map<string, number>();
		for (const s of sets) {
			const v = epley1RM(s.weight, s.reps);
			map.set(s.date, Math.max(map.get(s.date) ?? 0, v));
		}
		return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	const W = 320;
	const H = 140;
	const padding = { top: 12, right: 12, bottom: 24, left: 30 };

	const stats = $derived.by(() => {
		const values = data.map(([, v]) => v);
		if (values.length === 0) return null;
		return {
			min: Math.min(...values),
			max: Math.max(...values),
			latest: values[values.length - 1] ?? 0
		};
	});

	function path(): string {
		if (!stats || data.length === 0) return '';
		const innerW = W - padding.left - padding.right;
		const innerH = H - padding.top - padding.bottom;
		const span = Math.max(stats.max - stats.min, 1);
		return data
			.map(([, v], i) => {
				const x = padding.left + (data.length === 1 ? 0 : (i / (data.length - 1)) * innerW);
				const y = padding.top + innerH - ((v - stats.min) / span) * innerH;
				return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
			})
			.join(' ');
	}
</script>

<div class="hairline rounded-3xl bg-(--color-bg-soft) p-4">
	<div class="mb-3 flex items-center justify-between">
		<h3 class="text-sm font-medium">Прогресс 1RM (Epley)</h3>
		{#if stats}
			<span class="text-xs text-(--color-fg-mute) tabular-nums">
				мин {stats.min.toFixed(1)} · макс {stats.max.toFixed(1)} · сейчас {stats.latest.toFixed(1)}
			</span>
		{/if}
	</div>
	{#if !stats}
		<p class="py-6 text-center text-sm text-(--color-fg-mute)">Нет данных по этому упражнению</p>
	{:else}
		<svg viewBox="0 0 {W} {H}" class="block w-full">
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
			<path
				d={path()}
				fill="none"
				stroke="var(--color-accent)"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
			{#each data as [iso, value], i (iso)}
				{@const innerW = W - padding.left - padding.right}
				{@const innerH = H - padding.top - padding.bottom}
				{@const span = Math.max(stats.max - stats.min, 1)}
				{@const x = padding.left + (data.length === 1 ? 0 : (i / (data.length - 1)) * innerW)}
				{@const y = padding.top + innerH - ((value - stats.min) / span) * innerH}
				<circle cx={x} cy={y} r={2.5} fill="var(--color-accent)">
					<title>{formatRuShort(iso)}: {value.toFixed(1)} кг</title>
				</circle>
			{/each}
		</svg>
	{/if}
</div>
