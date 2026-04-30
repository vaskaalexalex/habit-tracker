<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { authStore } from '$stores/auth.svelte';
	import { habitsStore } from '$stores/habits.svelte';
	import { strengthStore } from '$stores/strength.svelte';
	import { cardioStore } from '$stores/cardio.svelte';
	import { journalStore } from '$stores/journal.svelte';
	import { reconcileSportCompletions } from '$stores/auto-complete';
	import { bootstrap } from '$lib/bootstrap';
	import BottomNav from '$components/BottomNav.svelte';
	import ToastHost from '$components/ToastHost.svelte';
	import InstallPrompt from '$components/InstallPrompt.svelte';

	let { children } = $props();
	let booted = $state(false);

	onMount(async () => {
		await bootstrap();
		booted = true;
	});

	$effect(() => {
		const userId = authStore.user?.id ?? null;
		habitsStore.setUser(userId);
		strengthStore.setUser(userId);
		cardioStore.setUser(userId);
		journalStore.setUser(userId);
	});

	$effect(() => {
		if (!habitsStore.loaded || !strengthStore.loaded || !cardioStore.loaded) return;
		void strengthStore.sets.length;
		void cardioStore.items.length;
		void habitsStore.completions.length;
		void reconcileSportCompletions();
	});

	$effect(() => {
		if (!booted || !authStore.initialized) return;
		const path = $page.url.pathname;
		const isAuthRoute =
			path.startsWith(`${base}/login`) || path.startsWith(`${base}/auth`);
		if (!authStore.user && !isAuthRoute) {
			void goto(`${base}/login`, { replaceState: true });
		} else if (authStore.user && path.startsWith(`${base}/login`)) {
			void goto(`${base}/`, { replaceState: true });
		}
	});

	const showNav = $derived(
		!!authStore.user &&
			!$page.url.pathname.startsWith(`${base}/login`) &&
			!$page.url.pathname.startsWith(`${base}/auth`)
	);
</script>

<div class="relative flex min-h-dvh flex-col">
	<main class="flex-1 pb-28">
		{#if booted}
			{@render children?.()}
		{:else}
			<div class="flex min-h-dvh items-center justify-center">
				<div
					class="size-10 animate-spin rounded-full border-2 border-(--color-fg-mute) border-t-(--color-accent)"
				></div>
			</div>
		{/if}
	</main>
	{#if showNav}
		<BottomNav />
	{/if}
	<ToastHost />
	<InstallPrompt />
</div>
