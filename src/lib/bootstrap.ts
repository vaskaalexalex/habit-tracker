import { authStore } from '$stores/auth.svelte';
import { startSyncWatchers } from '$db/sync';
import { themeStore } from '$stores/theme.svelte';
import { profileStore } from '$stores/profile.svelte';

let started = false;

export async function bootstrap(): Promise<void> {
	if (started) return;
	started = true;
	themeStore.init();
	profileStore.init();
	await authStore.init();
	startSyncWatchers();
}
