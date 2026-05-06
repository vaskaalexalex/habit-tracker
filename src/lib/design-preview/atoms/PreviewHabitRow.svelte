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
		density?: 'comfortable' | 'compact';
		showDivider?: boolean;
		minimal?: boolean;
	}

	let {
		habit,
		completed,
		streak,
		onclick,
		density = 'comfortable',
		showDivider = true,
		minimal = false
	}: Props = $props();

	const Icon = $derived(habitIcon[habit]);
	const color = $derived(habitColorVar(habit));
	const py = $derived(density === 'compact' ? 'py-2.5' : 'py-4');
</script>

<button
	type="button"
	class="tap-target flex w-full items-center gap-3 text-left transition active:opacity-90 {py}"
	onclick={() => onclick?.()}
	aria-label={HABIT_LABELS[habit]}
>
	{#if minimal}
		<span
			class="grid size-11 shrink-0 place-items-center rounded-full border border-(--color-border)"
			style="color: {color}; background: color-mix(in oklch, {color} 12%, transparent);"
		>
			<Icon size={22} strokeWidth={1.75} />
		</span>
	{:else}
		<span
			class="grid size-12 shrink-0 place-items-center rounded-2xl"
			style="background: color-mix(in oklch, {color} 18%, transparent); color: {color};"
		>
			<Icon size={22} strokeWidth={2} />
		</span>
	{/if}

	<span class="min-w-0 flex-1">
		<span class="block truncate font-medium tracking-tight">{HABIT_LABELS[habit]}</span>
		{#if streak > 0}
			<span class="mt-0.5 inline-flex items-center gap-1 text-xs text-(--color-fg-mute)">
				<Flame size={12} class="text-orange-400" />
				<span class="tabular-nums">{streak}</span>
				<span>дней подряд</span>
			</span>
		{/if}
	</span>

	{#if completed}
		<span
			class="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-emerald-400"
			aria-hidden="true"
		>
			<Check size={16} strokeWidth={2.5} />
		</span>
	{:else}
		<span class="size-8 shrink-0 rounded-full border border-(--color-border) bg-(--color-bg-mute)"
		></span>
	{/if}
</button>
{#if showDivider}
	<div class="h-px w-full bg-(--color-border) opacity-60"></div>
{/if}
