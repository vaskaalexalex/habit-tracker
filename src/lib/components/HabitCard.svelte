<script lang="ts">
	import { Dumbbell, Code2, BookOpen, Pencil, Check, Flame } from 'lucide-svelte';
	import { spring } from 'svelte/motion';
	import type { HabitType } from '$supabase/types';
	import { HABIT_LABELS } from '$supabase/types';

	interface Props {
		habit: HabitType;
		completed: boolean;
		streak: number;
		onclick: () => void;
		toggleable: boolean;
	}

	let { habit, completed, streak, onclick, toggleable }: Props = $props();

	const tone = {
		sport: {
			color: 'var(--color-sport)',
			icon: Dumbbell,
			gradient: 'from-orange-500/30 to-red-500/10'
		},
		coding: {
			color: 'var(--color-coding)',
			icon: Code2,
			gradient: 'from-emerald-500/30 to-teal-500/10'
		},
		reading: {
			color: 'var(--color-reading)',
			icon: BookOpen,
			gradient: 'from-violet-500/30 to-indigo-500/10'
		},
		journal: {
			color: 'var(--color-journal)',
			icon: Pencil,
			gradient: 'from-amber-500/30 to-yellow-500/10'
		}
	} as const;

	const t = $derived(tone[habit]);

	const scale = spring(1, { stiffness: 0.18, damping: 0.55 });

	function handleClick() {
		scale.set(1.04, { hard: true });
		setTimeout(() => scale.set(1), 140);
		onclick();
	}
</script>

<button
	type="button"
	onclick={handleClick}
	class="hairline group relative flex aspect-square min-h-24 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl bg-(--color-bg-soft) p-2 text-center transition active:scale-[0.97]"
	style="transform: scale({$scale});"
	aria-pressed={toggleable ? completed : undefined}
	aria-label={HABIT_LABELS[habit]}
>
	<div class="bg-gradient-to-br pointer-events-none absolute inset-0 opacity-60 {t.gradient}"></div>

	{#if completed}
		<span
			class="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-emerald-500/20 text-emerald-400"
			aria-label="Сделано сегодня"
		>
			<Check size={11} strokeWidth={3} />
		</span>
	{/if}

	<div
		class="relative grid size-10 place-items-center rounded-xl"
		style="background: color-mix(in oklch, {t.color} 22%, transparent); color: {t.color};"
	>
		<t.icon size={20} strokeWidth={2} />
	</div>

	<div class="relative flex min-w-0 flex-col items-center">
		<span class="truncate text-xs font-semibold tracking-tight">{HABIT_LABELS[habit]}</span>
		<span
			class="inline-flex items-center gap-0.5 text-[10px] text-(--color-fg-mute)"
			class:invisible={streak === 0}
			aria-hidden={streak === 0}
		>
			<Flame size={10} class="text-orange-400" />
			<span class="tabular-nums">{streak || 0}</span>
		</span>
	</div>
</button>
