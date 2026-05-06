<script lang="ts">
	import '$lib/design-variants.css';
	import { page } from '$app/stores';
	import PreviewToolbar from '$lib/design-preview/PreviewToolbar.svelte';
	import ClinicalMinimal from '$lib/design-preview/variants/ClinicalMinimal.svelte';
	import BoldDashboard from '$lib/design-preview/variants/BoldDashboard.svelte';
	import GlassOS from '$lib/design-preview/variants/GlassOS.svelte';
	import PaperJournal from '$lib/design-preview/variants/PaperJournal.svelte';
	import SportNeon from '$lib/design-preview/variants/SportNeon.svelte';
	import {
		mockHabitCompletions,
		mockCompletedToday,
		mockStreaks,
		mockProfileName,
		MOCK_TODAY
	} from '$lib/design-mocks/habits-preview';
	import { formatRu } from '$utils/dates';

	const variant = $derived.by(() => {
		const raw = $page.url.searchParams.get('v');
		const n = raw ? Number.parseInt(raw, 10) : 1;
		if (!Number.isFinite(n)) return 1;
		return Math.min(5, Math.max(1, n));
	});

	const mocks = $derived({
		completions: mockHabitCompletions,
		completedToday: mockCompletedToday,
		streaks: mockStreaks,
		todayLabel: formatRu(MOCK_TODAY),
		profileName: mockProfileName
	});

	$effect(() => {
		document.documentElement.setAttribute('data-design-variant', String(variant));
		return () => document.documentElement.removeAttribute('data-design-variant');
	});
</script>

<svelte:head>
	<title>Превью редизайна · Habit</title>
</svelte:head>

<div class="preview-root mx-auto w-full max-w-xl px-4 pb-4 pt-4 sm:pt-6">
	<PreviewToolbar {variant} />

	{#key variant}
		<div class={`preview-shell-v${variant}`}>
			{#if variant === 1}
				<ClinicalMinimal {...mocks} />
			{:else if variant === 2}
				<BoldDashboard {...mocks} />
			{:else if variant === 3}
				<GlassOS {...mocks} />
			{:else if variant === 4}
				<PaperJournal {...mocks} />
			{:else}
				<SportNeon {...mocks} />
			{/if}
		</div>
	{/key}
</div>
