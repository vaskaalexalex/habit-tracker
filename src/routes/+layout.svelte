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
	import { todayStore } from '$stores/today.svelte';
	import { reconcileSportCompletions } from '$stores/auto-complete';
	import { forcePushLocalData } from '$db/force-sync';
	import { bootstrap } from '$lib/bootstrap';
	import { syncDebug } from '$utils/sync-debug';
	import BottomNav from '$components/BottomNav.svelte';
	import ToastHost from '$components/ToastHost.svelte';
	import InstallPrompt from '$components/InstallPrompt.svelte';
	import SyncStatus from '$components/SyncStatus.svelte';

	let { children } = $props();
	let booted = $state(false);
	let lastRemoteRefresh = 0;
	let lastAutoPushUserId: string | null = null;

	onMount(() => {
		let stopRemoteRefresh: (() => void) | null = null;
		let stopTodayRefresh: (() => void) | null = null;
		let stopServiceWorkerUpdate: (() => void) | null = null;

		// Defensive: clear any stale inline html height from previous builds that pinned it on keyboard.
		document.documentElement.style.removeProperty('height');

		// iOS scrolls the nearest scroll ancestor (main / window) to bring focused inputs into view.
		// We want layout to stay put: keyboard overlays content, nothing reflows.
		const SCROLL_LOCK_FRAMES = 8;
		function onInputFocusIn(event: FocusEvent) {
			const t = event.target;
			if (!(t instanceof HTMLElement)) return;
			if (
				!t.matches(
					'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
				)
			)
				return;
			const main = document.querySelector('main');
			const startMainTop = main?.scrollTop ?? 0;
			const startWinTop = window.scrollY;
			let frames = 0;
			const revert = () => {
				if (main && main.scrollTop !== startMainTop) main.scrollTop = startMainTop;
				if (window.scrollY !== startWinTop) window.scrollTo({ top: startWinTop });
				if (++frames < SCROLL_LOCK_FRAMES) requestAnimationFrame(revert);
			};
			requestAnimationFrame(revert);
		}
		document.addEventListener('focusin', onInputFocusIn, true);

		syncDebug('layout-mount', {
			online: navigator.onLine,
			visibility: document.visibilityState,
			standalone: window.matchMedia('(display-mode: standalone)').matches
		});

		void bootstrap()
			.catch((err) => {
				syncDebug('bootstrap-error', {
					error: err instanceof Error ? err.message : String(err)
				});
			})
			.finally(() => {
				syncDebug('bootstrap-done', { hasUser: !!authStore.user, userId: authStore.user?.id });
				setStoresUser(authStore.user?.id ?? null);
				booted = true;
				stopTodayRefresh = todayStore.start();
				stopRemoteRefresh = startRemoteRefresh();
			});

		// Manual SW registration (avoids virtual:pwa-register → workbox-window in SSR bundle).
		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			let didReloadForServiceWorker = false;
			const reloadOnControllerChange = () => {
				if (didReloadForServiceWorker) return;
				didReloadForServiceWorker = true;
				window.location.reload();
			};
			const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
				registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
			};
			const registerServiceWorker = () => {
				const swPath = `${base}/sw.js`;
				const scope = base ? `${base}/` : '/';
				void navigator.serviceWorker
					.register(swPath, { scope })
					.then((registration) => {
						activateWaitingWorker(registration);
						registration.addEventListener('updatefound', () => {
							const worker = registration.installing;
							worker?.addEventListener('statechange', () => {
								if (worker.state === 'installed' && navigator.serviceWorker.controller) {
									worker.postMessage({ type: 'SKIP_WAITING' });
								}
							});
						});
						void registration.update().then(() => activateWaitingWorker(registration));
					})
					.catch(() => undefined);
			};
			navigator.serviceWorker.addEventListener('controllerchange', reloadOnControllerChange);
			window.addEventListener('load', registerServiceWorker);
			stopServiceWorkerUpdate = () => {
				navigator.serviceWorker.removeEventListener('controllerchange', reloadOnControllerChange);
				window.removeEventListener('load', registerServiceWorker);
			};
		}

		return () => {
			document.removeEventListener('focusin', onInputFocusIn, true);
			stopServiceWorkerUpdate?.();
			stopRemoteRefresh?.();
			stopTodayRefresh?.();
		};
	});

	function setStoresUser(userId: string | null) {
		syncDebug('stores-set-user', { hasUser: !!userId, userId });
		if (!userId) lastAutoPushUserId = null;
		habitsStore.setUser(userId);
		strengthStore.setUser(userId);
		cardioStore.setUser(userId);
		journalStore.setUser(userId);
	}

	async function refreshRemoteData(force = false) {
		if (!authStore.user) {
			syncDebug('remote-refresh-skip-no-user', { force });
			return;
		}
		if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
			syncDebug('remote-refresh-skip-hidden', { force });
			return;
		}
		const now = Date.now();
		if (!force && now - lastRemoteRefresh < 15_000) {
			syncDebug('remote-refresh-skip-throttle', { force, elapsedMs: now - lastRemoteRefresh });
			return;
		}
		lastRemoteRefresh = now;
		syncDebug('remote-refresh-start', {
			force,
			userId: authStore.user.id,
			online: navigator.onLine,
			visibility: document.visibilityState
		});

		const canReachNetwork = typeof navigator === 'undefined' || navigator.onLine !== false;
		if (canReachNetwork && lastAutoPushUserId !== authStore.user.id) {
			try {
				await forcePushLocalData(authStore.user.id);
				lastAutoPushUserId = authStore.user.id;
			} catch (err) {
				syncDebug('auto-local-push-error', { error: err });
			}
		}

		void Promise.allSettled([
			habitsStore.refresh(),
			strengthStore.refresh(),
			cardioStore.refresh(),
			journalStore.refresh()
		]).then((results) => {
			syncDebug('remote-refresh-finish', {
				habits: results[0].status,
				strength: results[1].status,
				cardio: results[2].status,
				journal: results[3].status
			});
			void reconcileSportCompletions();
		});
	}

	function startRemoteRefresh() {
		if (typeof window === 'undefined') return () => undefined;

		const refreshNow = () => {
			syncDebug('remote-refresh-event');
			void refreshRemoteData(true);
		};
		const refreshWhenVisible = () => {
			if (document.visibilityState === 'visible') void refreshRemoteData(true);
		};

		window.addEventListener('focus', refreshNow);
		window.addEventListener('pageshow', refreshNow);
		window.addEventListener('online', refreshNow);
		document.addEventListener('visibilitychange', refreshWhenVisible);
		const interval = window.setInterval(() => void refreshRemoteData(), 15_000);

		void refreshRemoteData(true);

		return () => {
			window.removeEventListener('focus', refreshNow);
			window.removeEventListener('pageshow', refreshNow);
			window.removeEventListener('online', refreshNow);
			document.removeEventListener('visibilitychange', refreshWhenVisible);
			window.clearInterval(interval);
		};
	}

	$effect(() => {
		setStoresUser(authStore.user?.id ?? null);
		if (booted && authStore.user) void refreshRemoteData(true);
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
		const isAuthRoute = path.startsWith(`${base}/login`) || path.startsWith(`${base}/auth`);
		const allowWithoutAuth = path.startsWith(`${base}/design-preview`);
		if (!authStore.user && !isAuthRoute && !allowWithoutAuth) {
			void goto(`${base}/login`, { replaceState: true });
		} else if (authStore.user && path.startsWith(`${base}/login`)) {
			void goto(`${base}/`, { replaceState: true });
		}
	});

	const isDesignPreview = $derived($page.url.pathname.startsWith(`${base}/design-preview`));

	const showNav = $derived(
		(!!authStore.user || isDesignPreview) &&
			!$page.url.pathname.startsWith(`${base}/login`) &&
			!$page.url.pathname.startsWith(`${base}/auth`)
	);
</script>

<div class="app-shell relative flex min-h-0 w-full flex-col overflow-hidden">
	<main
		class="safe-top flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
		class:pb-bottom-nav={showNav}
	>
		{#if booted}
			{@render children?.()}
		{:else}
			<div class="flex flex-1 items-center justify-center">
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
	<SyncStatus />
</div>
