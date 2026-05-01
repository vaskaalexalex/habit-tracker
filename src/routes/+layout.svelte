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
	let lastRemoteRefresh = 0;

	onMount(() => {
		let stopRemoteRefresh: (() => void) | null = null;

		void bootstrap().then(() => {
			booted = true;
			stopRemoteRefresh = startRemoteRefresh();
		});

		return () => {
			stopRemoteRefresh?.();
		};
	});

	function refreshRemoteData(force = false) {
		if (!authStore.user) return;
		if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
		const now = Date.now();
		if (!force && now - lastRemoteRefresh < 15_000) return;
		lastRemoteRefresh = now;

		void Promise.allSettled([
			habitsStore.refresh(),
			strengthStore.refresh(),
			cardioStore.refresh(),
			journalStore.refresh()
		]).then(() => {
			void reconcileSportCompletions();
		});
	}

	function startRemoteRefresh() {
		if (typeof window === 'undefined') return () => undefined;

		const refreshNow = () => refreshRemoteData(true);
		const refreshWhenVisible = () => {
			if (document.visibilityState === 'visible') refreshRemoteData(true);
		};

		window.addEventListener('focus', refreshNow);
		window.addEventListener('pageshow', refreshNow);
		window.addEventListener('online', refreshNow);
		document.addEventListener('visibilitychange', refreshWhenVisible);
		const interval = window.setInterval(() => refreshRemoteData(), 15_000);

		refreshRemoteData(true);

		return () => {
			window.removeEventListener('focus', refreshNow);
			window.removeEventListener('pageshow', refreshNow);
			window.removeEventListener('online', refreshNow);
			document.removeEventListener('visibilitychange', refreshWhenVisible);
			window.clearInterval(interval);
		};
	}

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
	<main class="safe-top flex-1" class:pb-28={showNav}>
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
