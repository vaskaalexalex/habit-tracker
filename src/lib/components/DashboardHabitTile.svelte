<script lang="ts">
	import { Check, Flame } from 'lucide-svelte';
	import type { HabitType } from '$supabase/types';
	import { HABIT_LABELS } from '$supabase/types';
	import { habitIcon, habitColorVar } from '$lib/habit-visual';

	interface Props {
		habit: HabitType;
		completed: boolean;
		streak: number;
		onclick?: () => void;
		size?: 'compact' | 'md' | 'lg' | 'hero';
		glass?: boolean;
		/** Заполнить высоту ячейки грида (bento). */
		stretch?: boolean;
	}

	let {
		habit,
		completed,
		streak,
		onclick,
		size = 'md',
		glass = false,
		stretch = false
	}: Props = $props();

	const Icon = $derived(habitIcon[habit]);
	const color = $derived(habitColorVar(habit));

	const box = $derived(
		size === 'hero'
			? 'min-h-[8.5rem] p-4 sm:min-h-36 sm:p-5 md:min-h-40'
			: size === 'lg'
				? 'min-h-[7rem] p-3 sm:min-h-32 sm:p-4'
				: size === 'compact'
					? 'h-[4.75rem] min-h-[4.75rem] p-2 sm:h-[5.25rem] sm:min-h-[5.25rem] sm:p-2.5'
					: 'min-h-[5.25rem] p-2.5 sm:min-h-24 sm:p-3'
	);
	const titleSize = $derived(
		size === 'hero'
			? 'text-base sm:text-lg md:text-xl'
			: size === 'lg'
				? 'text-sm sm:text-base'
				: size === 'compact'
					? 'text-[11px] leading-tight sm:text-xs'
					: 'text-xs sm:text-sm'
	);
	const iconWrap = $derived(
		size === 'hero'
			? 'size-12 rounded-2xl sm:size-14 sm:rounded-3xl'
			: size === 'lg'
				? 'size-11 rounded-2xl sm:size-12 sm:rounded-3xl'
				: size === 'compact'
					? 'size-8 rounded-2xl sm:size-9 sm:rounded-3xl'
					: 'size-9 rounded-2xl sm:size-10 sm:rounded-3xl'
	);
	const iconSz = $derived(
		size === 'hero' ? 26 : size === 'lg' ? 22 : size === 'compact' ? 16 : 18
	);
</script>

<button
	type="button"
	class="tap-target group relative flex w-full flex-row items-center gap-2 overflow-hidden rounded-2xl border border-(--color-border) text-left transition active:scale-[0.99] sm:gap-2.5 sm:rounded-3xl {box}"
	class:bg-(--color-bg-soft)={!glass}
	class:glass
	class:h-full={stretch}
	class:min-h-[9rem]={stretch && size !== 'compact'}
	class:sm:min-h-[11rem]={stretch && size !== 'compact'}
	style={glass ? '' : undefined}
	onclick={() => onclick?.()}
	aria-label={HABIT_LABELS[habit]}
>
	{#if !glass}
		<div
			class="pointer-events-none absolute inset-0 opacity-40"
			style="background: radial-gradient(ellipse at top right, color-mix(in oklch, {color} 35%, transparent), transparent 55%);"
		></div>
	{/if}

	<div class="relative z-[1] flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
		<span
			class="relative grid shrink-0 place-items-center {iconWrap}"
			style="background: color-mix(in oklch, {color} 22%, transparent); color: {color};"
		>
			<Icon size={iconSz} strokeWidth={2} />
		</span>
		<span class="min-w-0 flex-1 truncate font-semibold tracking-tight {titleSize}">
			{HABIT_LABELS[habit]}
		</span>
		{#if streak > 0}
			<span
				class="inline-flex shrink-0 items-center gap-0.5 tabular-nums text-[10px] text-(--color-fg-mute) sm:text-[11px]"
			>
				<Flame size={10} class="shrink-0 text-orange-400 sm:hidden" />
				<Flame size={11} class="hidden shrink-0 text-orange-400 sm:inline" />
				{streak}
			</span>
		{/if}
	</div>

	{#if completed}
		<span
			class="relative z-[1] grid shrink-0 place-items-center rounded-full bg-emerald-500/25 text-emerald-400 size-4 sm:size-5 md:size-6"
		>
			{#if size === 'compact'}
				<Check size={10} strokeWidth={2.5} />
			{:else}
				<Check size={13} strokeWidth={2.5} class="sm:hidden" />
				<Check size={14} strokeWidth={2.5} class="hidden sm:block" />
			{/if}
		</span>
	{/if}
</button>
