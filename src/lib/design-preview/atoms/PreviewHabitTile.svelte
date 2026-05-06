<script lang="ts">
	import DashboardHabitTile from '$components/DashboardHabitTile.svelte';
	import type { HabitType } from '$supabase/types';

	interface Props {
		habit: HabitType;
		completed: boolean;
		streak: number;
		onclick?: () => void;
		size?: 'compact' | 'md' | 'lg' | 'hero';
		glass?: boolean;
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
</script>

<DashboardHabitTile {habit} {completed} {streak} {onclick} {size} {glass} {stretch} />
