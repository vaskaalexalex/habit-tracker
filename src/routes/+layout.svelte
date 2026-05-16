<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto, onNavigate } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import { authStore } from '$stores/auth.svelte';
	import { habitsStore } from '$stores/habits.svelte';
	import { strengthStore } from '$stores/strength.svelte';
	import { cardioStore } from '$stores/cardio.svelte';
	import { journalStore } from '$stores/journal.svelte';
	import { todayStore } from '$stores/today.svelte';
	import { reconcileJournalCompletions, reconcileSportCompletions } from '$stores/auto-complete';
	import { forcePushLocalData } from '$db/force-sync';
	import { bootstrap } from '$lib/bootstrap';
	import { syncDebug } from '$utils/sync-debug';
	import BottomNav from '$components/BottomNav.svelte';
	import ToastHost from '$components/ToastHost.svelte';
	import InstallPrompt from '$components/InstallPrompt.svelte';
	import { syncStatusStore } from '$stores/sync-status.svelte';
	import { mainTabIndex } from '$lib/nav/main-tab-index';
	import { isSamePathname } from '$lib/nav/same-pathname';
	import { syncUserReminderTimezone } from '$lib/push/reminders';
	import { ensurePushServiceWorkerRegistration } from '$lib/push/service-worker';

	let { children } = $props();
	let booted = $state(false);

	onNavigate((navigation) => {
		const fromUrl = navigation.from?.url;
		const toUrl = navigation.to?.url;
		if (
			fromUrl &&
			toUrl &&
			isSamePathname(fromUrl.pathname, toUrl.pathname) &&
			fromUrl.search === toUrl.search
		) {
			return;
		}
		if (typeof document === 'undefined' || !document.startViewTransition) return;
		return new Promise<void>((resolve) => {
			const fromPath = navigation.from?.url.pathname ?? '';
			const toPath = navigation.to?.url.pathname ?? '';
			const i0 = mainTabIndex(fromPath, base);
			const i1 = mainTabIndex(toPath, base);

			if (i0 !== null && i1 !== null && i0 !== i1) {
				document.documentElement.dataset.vtTab = i1 > i0 ? 'forward' : 'back';
			} else {
				delete document.documentElement.dataset.vtTab;
			}

			const vt = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});

			void vt.finished.finally(() => {
				delete document.documentElement.dataset.vtTab;
			});
		});
	});
	let lastRemoteRefresh = 0;
	let lastAutoPushUserId: string | null = null;

	onMount(() => {
		let stopRemoteRefresh: (() => void) | null = null;
		let stopTodayRefresh: (() => void) | null = null;
		let stopServiceWorkerUpdate: (() => void) | null = null;
		const stopSyncStatus = syncStatusStore.start();

		// Defensive: clear any stale inline html height from previous builds that pinned it on keyboard.
		document.documentElement.style.removeProperty('height');

		// iOS scrolls the nearest scroll ancestor (main / window) to bring focused inputs into view.
		// We want layout to stay put: keyboard overlays content, nothing reflows.
		const SCROLL_LOCK_FRAMES = 8;
		function onInputFocusIn(event: FocusEvent) {
			const t = event.target;
			if (!(t instanceof HTMLElement)) return;
			if (!t.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]'))
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

		// iOS PWA: after keyboard dismiss Safari can leave main/window scrolled — strip under fixed nav.
		const SCROLL_RESET_FRAMES = 6;
		function forceScrollReset() {
			const main = document.querySelector('main');
			let frames = 0;
			const tick = () => {
				if (main && main.scrollTop !== 0) main.scrollTop = 0;
				if (window.scrollY !== 0) window.scrollTo({ top: 0 });
				const root = document.scrollingElement ?? document.documentElement;
				if (root && root.scrollTop !== 0) root.scrollTop = 0;
				if (++frames < SCROLL_RESET_FRAMES) requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
		}

		function onInputFocusOut(event: FocusEvent) {
			const t = event.target;
			if (!(t instanceof HTMLElement)) return;
			if (!t.matches('input, textarea, select, [contenteditable=""], [contenteditable="true"]'))
				return;
			forceScrollReset();
		}
		document.addEventListener('focusout', onInputFocusOut, true);

		const vv = window.visualViewport ?? null;
		const onVisualViewportResize = () => {
			if (!vv) return;
			if (vv.height >= window.innerHeight - 1) forceScrollReset();
		};
		vv?.addEventListener('resize', onVisualViewportResize);

		syncDebug('layout-mount', {
			online: navigator.onLine,
			visibility: document.visibilityState,
			standalone: window.matchMedia('(display-mode: standalone)').matches
		});

		const onPageShow = (event: PageTransitionEvent) => {
			if (!event.persisted) return;
			syncDebug('layout-pageshow-persisted-bootstrap');
			void bootstrap(true)
				.then(() => {
					setStoresUser(authStore.user?.id ?? null);
					if (authStore.user) {
						return Promise.all([
							strengthStore.hydrateLocal(),
							cardioStore.hydrateLocal(),
							habitsStore.hydrateLocal(),
							journalStore.hydrateLocal()
						]);
					}
				})
				.catch((err) => {
					syncDebug('bootstrap-pageshow-error', {
						error: err instanceof Error ? err.message : String(err)
					});
				});
		};
		window.addEventListener('pageshow', onPageShow);

		void bootstrap()
			.catch((err) => {
				syncDebug('bootstrap-error', {
					error: err instanceof Error ? err.message : String(err)
				});
			})
			.finally(async () => {
				syncDebug('bootstrap-done', { hasUser: !!authStore.user, userId: authStore.user?.id });
				setStoresUser(authStore.user?.id ?? null);
				if (authStore.user) {
					try {
						await Promise.all([
							strengthStore.hydrateLocal(),
							cardioStore.hydrateLocal(),
							habitsStore.hydrateLocal(),
							journalStore.hydrateLocal()
						]);
						await reconcileSportCompletions();
						await reconcileJournalCompletions();
					} catch (err) {
						syncDebug('hydrate-local-error', {
							error: err instanceof Error ? err.message : String(err)
						});
					}
				}
				booted = true;
				stopTodayRefresh = todayStore.start();
				stopRemoteRefresh = startRemoteRefresh();
			});

		// Manual SW registration (avoids virtual:pwa-register → workbox-window in SSR bundle).
		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			let didReloadForServiceWorker = false;
			let pendingSwReload = false;
			const reloadOnControllerChange = () => {
				if (didReloadForServiceWorker) return;
				if (typeof navigator !== 'undefined' && navigator.onLine === false) {
					pendingSwReload = true;
					syncDebug('sw-controllerchange-reload-deferred-offline');
					return;
				}
				didReloadForServiceWorker = true;
				window.location.reload();
			};
			const flushPendingSwReload = () => {
				if (!pendingSwReload || didReloadForServiceWorker) return;
				if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
				didReloadForServiceWorker = true;
				pendingSwReload = false;
				syncDebug('sw-controllerchange-reload-flush-online');
				window.location.reload();
			};
			void ensurePushServiceWorkerRegistration();
			navigator.serviceWorker.addEventListener('controllerchange', reloadOnControllerChange);
			window.addEventListener('online', flushPendingSwReload);
			stopServiceWorkerUpdate = () => {
				navigator.serviceWorker.removeEventListener('controllerchange', reloadOnControllerChange);
				window.removeEventListener('online', flushPendingSwReload);
			};
		}

		return () => {
			window.removeEventListener('pageshow', onPageShow);
			document.removeEventListener('focusin', onInputFocusIn, true);
			document.removeEventListener('focusout', onInputFocusOut, true);
			vv?.removeEventListener('resize', onVisualViewportResize);
			stopServiceWorkerUpdate?.();
			stopRemoteRefresh?.();
			stopTodayRefresh?.();
			stopSyncStatus();
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
			void reconcileJournalCompletions();
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
		if (!booted || !authStore.user?.id) return;
		void syncUserReminderTimezone(authStore.user.id);
	});

	$effect(() => {
		if (!habitsStore.loaded || !strengthStore.loaded || !cardioStore.loaded || !journalStore.loaded)
			return;
		void strengthStore.sets.length;
		void cardioStore.items.length;
		void journalStore.entries.length;
		void habitsStore.completions.length;
		void reconcileSportCompletions();
		void reconcileJournalCompletions();
	});

	$effect(() => {
		if (!booted || !authStore.initialized || authStore.loading) return;
		const path = $page.url.pathname;
		const isAuthRoute = path.startsWith(`${base}/login`) || path.startsWith(`${base}/auth`);
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

<div class="app-shell relative flex min-h-0 w-full flex-col overflow-hidden">
	{#if !booted}
		<div class="pointer-events-none fixed inset-x-0 top-0 z-[48] flex flex-col" aria-hidden="true">
			<div class="shrink-0" style="height: env(safe-area-inset-top, 0px);"></div>
			<div class="h-[3px] w-full overflow-hidden bg-(--color-bg-mute)">
				<div class="bootstrap-load-bar__stripe"></div>
			</div>
		</div>
	{/if}
	<main
		class="app-main-vt safe-top flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain"
		class:pb-bottom-nav={showNav}
	>
		{#if booted}
			{@render children?.()}
		{:else}
			<div class="min-h-0 flex-1 bg-(--color-bg)"></div>
		{/if}
	</main>
	{#if showNav}
		<BottomNav />
	{/if}
	<ToastHost />
	<InstallPrompt />
</div>
