import { base } from '$app/paths';

function activateWaitingWorker(registration: ServiceWorkerRegistration) {
	registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

/** Register the app SW (same path/scope as +layout). Safe to call multiple times. */
export async function ensurePushServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

	const swPath = `${base}/sw.js`;
	const scope = base ? `${base}/` : '/';

	let registration = await navigator.serviceWorker.getRegistration(scope);
	if (!registration) {
		try {
			registration = await navigator.serviceWorker.register(swPath, { scope });
			activateWaitingWorker(registration);
			void registration.update().then(() => activateWaitingWorker(registration!));
		} catch {
			return null;
		}
	}

	await navigator.serviceWorker.ready;
	return registration;
}
