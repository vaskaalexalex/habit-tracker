<script lang="ts">
	import { onMount } from 'svelte';
	import { CloudOff, CloudUpload } from 'lucide-svelte';
	import { syncStatusStore } from '$stores/sync-status.svelte';
	import { drainQueue } from '$db/sync';

	onMount(() => syncStatusStore.start());

	const offline = $derived(!syncStatusStore.online);
	const pending = $derived(syncStatusStore.pending);
	const visible = $derived(offline || pending > 0);
	const label = $derived(
		offline
			? pending > 0
				? `Оффлайн · ${pending} в очереди`
				: 'Оффлайн'
			: pending > 0
				? `Ожидает отправки · ${pending}`
				: ''
	);

	function retry() {
		if (!syncStatusStore.online) return;
		void drainQueue();
	}
</script>

{#if visible}
	<div
		class="glass safe-top pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-2"
	>
		<button
			type="button"
			class="pointer-events-auto flex items-center gap-2 rounded-full border border-(--color-border) bg-(--color-bg-soft) px-3 py-1.5 text-xs font-medium text-(--color-fg-mute) shadow-sm active:scale-95"
			aria-live="polite"
			disabled={offline}
			title={offline ? 'Без сети данные сохраняются локально' : 'Нажми, чтобы отправить на сервер'}
			onclick={retry}
		>
			{#if offline}
				<CloudOff size={14} />
			{:else}
				<CloudUpload size={14} />
			{/if}
			<span>{label}</span>
		</button>
	</div>
{/if}
