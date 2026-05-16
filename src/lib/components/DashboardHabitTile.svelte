<script lang="ts">
	import { onMount } from 'svelte';
	import { Flame } from 'lucide-svelte';
	import { spring } from 'svelte/motion';
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
		/** Локально инвертировать «выполнено» по клику (только для привычек с toggle в сторе). */
		flipVisualOnClick?: boolean;
	}

	let {
		habit,
		completed,
		streak,
		onclick,
		size = 'md',
		glass = false,
		stretch = false,
		flipVisualOnClick = true
	}: Props = $props();

	const Icon = $derived(habitIcon[habit]);
	const color = $derived(habitColorVar(habit));

	let reduceMotion = $state(false);
	let mounted = $state(false);
	onMount(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduceMotion = mq.matches;
		const onChange = () => {
			reduceMotion = mq.matches;
		};
		mq.addEventListener('change', onChange);
		// Defer the mounted flag by a frame so the initial completed state
		// renders without playing the clip-path transition.
		const raf = requestAnimationFrame(() => {
			mounted = true;
		});
		return () => {
			mq.removeEventListener('change', onChange);
			cancelAnimationFrame(raf);
		};
	});

	const scale = spring(1, { stiffness: 0.18, damping: 0.55 });

	let rx = $state(50);
	let ry = $state(50);

	// Local visual state, decoupled from the `completed` prop for ~600ms
	// after a click. This prevents flicker if any background sync briefly
	// re-introduces a just-removed row before the next refresh corrects it.
	let visualCompleted = $state(false);
	let lastClickAt = 0;
	const CLICK_LOCK_MS = 600;

	$effect(() => {
		const next = completed;
		const elapsed = Date.now() - lastClickAt;
		if (elapsed >= CLICK_LOCK_MS) {
			visualCompleted = next;
			return;
		}
		const id = window.setTimeout(() => {
			visualCompleted = completed;
		}, CLICK_LOCK_MS - elapsed);
		return () => window.clearTimeout(id);
	});

	function handleClick(e: MouseEvent) {
		if (!visualCompleted) {
			const target = e.currentTarget as HTMLElement | null;
			if (target && e.detail !== 0) {
				const rect = target.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0) {
					rx = ((e.clientX - rect.left) / rect.width) * 100;
					ry = ((e.clientY - rect.top) / rect.height) * 100;
				}
			} else {
				rx = 50;
				ry = 50;
			}
		}
		if (flipVisualOnClick) {
			visualCompleted = !visualCompleted;
			lastClickAt = Date.now();
		}
		if (!reduceMotion) {
			scale.set(1.04, { hard: true });
			window.setTimeout(() => scale.set(1), 140);
		}
		onclick?.();
	}

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
			? 'text-lg sm:text-xl md:text-2xl'
			: size === 'lg'
				? 'text-base sm:text-lg'
				: size === 'compact'
					? 'text-sm leading-tight sm:text-base'
					: 'text-sm sm:text-base'
	);
	const iconWrap = $derived(
		size === 'hero'
			? 'size-14 rounded-2xl sm:size-16 sm:rounded-3xl'
			: size === 'lg'
				? 'size-12 rounded-2xl sm:size-14 sm:rounded-3xl'
				: size === 'compact'
					? 'size-10 rounded-2xl sm:size-11 sm:rounded-3xl'
					: 'size-11 rounded-2xl sm:size-12 sm:rounded-3xl'
	);
	const iconSz = $derived(size === 'hero' ? 30 : size === 'lg' ? 26 : size === 'compact' ? 20 : 22);
</script>

<button
	type="button"
	class="habit-tile-btn tap-target group relative flex w-full flex-row items-center gap-2 overflow-hidden rounded-2xl border border-(--color-border) text-left sm:gap-2.5 sm:rounded-3xl {box}"
	class:bg-(--color-bg-soft)={!glass}
	class:glass
	class:h-full={stretch}
	class:min-h-[9rem]={stretch && size !== 'compact'}
	class:sm:min-h-[11rem]={stretch && size !== 'compact'}
	class:completed={visualCompleted}
	style="transform: scale({$scale})"
	onclick={handleClick}
	aria-label={HABIT_LABELS[habit]}
	aria-pressed={visualCompleted}
>
	<span
		class="habit-tile-fill"
		class:habit-tile-fill--on={visualCompleted}
		class:habit-tile-fill--anim={mounted && !reduceMotion}
		style="--rx:{rx}%;--ry:{ry}%;--c:{color};"
		aria-hidden="true"
	></span>

	{#if !glass}
		<div
			class="pointer-events-none absolute inset-0 opacity-40"
			style="background: radial-gradient(ellipse at top right, color-mix(in oklch, {color} 35%, transparent), transparent 55%);"
		></div>
	{/if}

	<div class="relative z-[1] flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
		<span
			class="habit-tile-icon relative grid shrink-0 place-items-center {iconWrap}"
			style="--c:{color};"
		>
			<Icon size={iconSz} strokeWidth={2} />
		</span>
		<span class="min-w-0 flex-1 truncate font-semibold tracking-tight {titleSize}">
			{HABIT_LABELS[habit]}
		</span>
		{#if streak > 0}
			<span
				class="habit-tile-streak inline-flex shrink-0 items-center gap-1 tabular-nums text-xs text-(--color-fg-mute) sm:text-sm"
			>
				<Flame size={13} class="habit-tile-streak__icon shrink-0 text-orange-400 sm:hidden" />
				<Flame
					size={14}
					class="habit-tile-streak__icon hidden shrink-0 text-orange-400 sm:inline"
				/>
				{streak}
			</span>
		{/if}
	</div>
</button>

<style>
	@media (prefers-reduced-motion: reduce) {
		.habit-tile-btn {
			transform: none !important;
		}
	}
</style>
