import { pendingSyncCount, subscribeSyncQueue, isSyncDrainActive } from '$db/sync';
import { isSupabaseConfigured } from '$supabase/client';

export type SyncTier = 'red' | 'yellow' | 'green';

class SyncStatusStore {
	online = $state<boolean>(true);
	pending = $state<number>(0);
	draining = $state<boolean>(false);

	syncTier = $derived.by((): SyncTier => {
		if (!this.online || !isSupabaseConfigured) return 'red';
		if (this.draining || this.pending > 0) return 'yellow';
		return 'green';
	});

	#stop: (() => void) | null = null;

	start(): () => void {
		if (typeof window === 'undefined') return () => undefined;
		if (this.#stop) return this.#stop;

		this.online = navigator.onLine;
		void this.#refreshPending();

		const handleOnline = () => {
			this.online = true;
			void this.#refreshPending();
		};
		const handleOffline = () => {
			this.online = false;
			void this.#refreshPending();
		};
		const handleVisibility = () => {
			if (document.visibilityState === 'visible') void this.#refreshPending();
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		document.addEventListener('visibilitychange', handleVisibility);

		const unsubscribe = subscribeSyncQueue(() => {
			void this.#refreshPending();
		});
		const interval = window.setInterval(() => void this.#refreshPending(), 5_000);

		this.#stop = () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
			document.removeEventListener('visibilitychange', handleVisibility);
			unsubscribe();
			window.clearInterval(interval);
			this.#stop = null;
		};

		return this.#stop;
	}

	async #refreshPending(): Promise<void> {
		try {
			this.pending = await pendingSyncCount();
			this.draining = isSyncDrainActive();
		} catch {
			/* ignore */
		}
	}
}

export const syncStatusStore = new SyncStatusStore();
