import { authStore } from '$stores/auth.svelte';
import { startSyncWatchers } from '$db/sync';
import { requestPersistentStorage } from '$db/persist';
import { themeStore } from '$stores/theme.svelte';
import { profileStore } from '$stores/profile.svelte';

let started = false;

export async function bootstrap(force = false): Promise<void> {
	if (started && !force) return;
	started = true;
	if (force) authStore.prepareReinit();
	await clearLegacyApiCache();
	// Best-effort: protect local data from browser eviction. Never blocks boot.
	void requestPersistentStorage();
	themeStore.init();
	profileStore.init();
	await authStore.init();
	startSyncWatchers();
}

async function clearLegacyApiCache(): Promise<void> {
	if (typeof window === 'undefined' || !('caches' in window)) return;
	await window.caches.delete('supabase-api');
}
