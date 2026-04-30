<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$stores/auth.svelte';
	import { Loader2 } from 'lucide-svelte';

	onMount(async () => {
		await authStore.init();
		setTimeout(() => {
			void goto('/', { replaceState: true });
		}, 600);
	});
</script>

<div class="flex min-h-dvh items-center justify-center text-(--color-fg-mute)">
	<div class="flex items-center gap-3 text-sm">
		<Loader2 class="animate-spin" size={18} />
		<span>Завершаем вход…</span>
	</div>
</div>
