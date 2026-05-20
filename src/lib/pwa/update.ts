import { ensurePushServiceWorkerRegistration } from '$lib/push/service-worker';

const RESET_KEY = 'habit-pwa-asset-reset';

function postSkipWaiting(worker: ServiceWorker) {
	worker.postMessage({ type: 'SKIP_WAITING' });
}

function waitForInstallingWorker(registration: ServiceWorkerRegistration): Promise<ServiceWorker | null> {
	const installing = registration.installing;
	if (!installing) return Promise.resolve(registration.waiting);

	return new Promise((resolve) => {
		const worker = installing;
		const onStateChange = () => {
			if (worker.state === 'installed') {
				worker.removeEventListener('statechange', onStateChange);
				resolve(registration.waiting);
			}
			if (worker.state === 'redundant') {
				worker.removeEventListener('statechange', onStateChange);
				resolve(null);
			}
		};
		worker.addEventListener('statechange', onStateChange);
		onStateChange();
	});
}

export type SwUpdateResult = 'reloading' | 'already-latest' | 'offline' | 'unsupported';

/** Check SW on the server and activate a waiting worker if present. */
export async function applyServiceWorkerUpdate(): Promise<SwUpdateResult> {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
		return 'unsupported';
	}
	if (navigator.onLine === false) return 'offline';

	const registration = await ensurePushServiceWorkerRegistration();
	if (!registration) return 'unsupported';

	try {
		await registration.update();
	} catch {
		return 'unsupported';
	}

	if (registration.waiting) {
		postSkipWaiting(registration.waiting);
		return 'reloading';
	}

	const waiting = await waitForInstallingWorker(registration);
	if (waiting) {
		postSkipWaiting(waiting);
		return 'reloading';
	}

	return 'already-latest';
}

/** Full reset: unregister SW, clear caches, reload (same idea as app.html import-failure recovery). */
export async function hardResetPwaCaches(): Promise<void> {
	if (typeof window === 'undefined') return;
	if (navigator.onLine === false) {
		throw new Error('Нужен интернет для полного обновления');
	}
	if (sessionStorage.getItem(RESET_KEY) === '1') {
		window.location.reload();
		return;
	}
	sessionStorage.setItem(RESET_KEY, '1');

	try {
		const registrations = await navigator.serviceWorker?.getRegistrations?.();
		await Promise.all((registrations ?? []).map((r) => r.unregister()));
	} catch {
		/* ignore */
	}

	try {
		const keys = await caches?.keys?.();
		await Promise.all((keys ?? []).map((key) => caches.delete(key)));
	} catch {
		/* ignore */
	}

	const url = new URL(window.location.href);
	url.searchParams.set('pwa_reset', String(Date.now()));
	window.location.replace(url.href);
}

export async function forceAppUpdate(opts?: { hardIfSoftFails?: boolean }): Promise<SwUpdateResult> {
	const soft = await applyServiceWorkerUpdate();
	if (soft === 'reloading' || soft === 'offline' || soft === 'unsupported') {
		return soft;
	}
	if (opts?.hardIfSoftFails) {
		await hardResetPwaCaches();
		return 'reloading';
	}
	return soft;
}
