import { syncDebug } from '$utils/sync-debug';

export interface StorageStatus {
	/** True when the browser granted persistent storage (not subject to eviction). */
	persisted: boolean;
	/** True when the Storage Manager API is available in this environment. */
	supported: boolean;
	/** Bytes used by this origin, when the browser exposes an estimate. */
	usage?: number;
	/** Bytes available to this origin, when the browser exposes an estimate. */
	quota?: number;
}

function hasStorageManager(): boolean {
	return (
		typeof navigator !== 'undefined' &&
		'storage' in navigator &&
		typeof navigator.storage?.persist === 'function'
	);
}

/**
 * Ask the browser to keep IndexedDB/localStorage from being evicted.
 * Idempotent and best-effort: safe to call on every boot. Returns the
 * resulting persisted flag (false when unsupported or denied).
 */
export async function requestPersistentStorage(): Promise<boolean> {
	if (!hasStorageManager()) {
		syncDebug('persist-unsupported');
		return false;
	}
	try {
		if (await navigator.storage.persisted()) {
			syncDebug('persist-already-granted');
			return true;
		}
		const granted = await navigator.storage.persist();
		syncDebug('persist-request-result', { granted });
		return granted;
	} catch (err) {
		syncDebug('persist-request-error', {
			error: err instanceof Error ? err.message : String(err)
		});
		return false;
	}
}

/** Current persistence + usage snapshot for the settings UI. */
export async function storageStatus(): Promise<StorageStatus> {
	if (!hasStorageManager()) {
		return { persisted: false, supported: false };
	}
	try {
		const persisted = await navigator.storage.persisted();
		let usage: number | undefined;
		let quota: number | undefined;
		if (typeof navigator.storage.estimate === 'function') {
			const est = await navigator.storage.estimate();
			usage = est.usage;
			quota = est.quota;
		}
		return { persisted, supported: true, usage, quota };
	} catch (err) {
		syncDebug('persist-status-error', {
			error: err instanceof Error ? err.message : String(err)
		});
		return { persisted: false, supported: true };
	}
}
