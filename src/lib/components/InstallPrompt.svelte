<script lang="ts">
	import { onMount } from 'svelte';
	import { Download, X } from 'lucide-svelte';

	interface BeforeInstallPromptEvent extends Event {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let deferred = $state<BeforeInstallPromptEvent | null>(null);
	let dismissed = $state(false);

	onMount(() => {
		if (typeof window === 'undefined') return;
		const handler = (e: Event) => {
			e.preventDefault();
			deferred = e as BeforeInstallPromptEvent;
		};
		window.addEventListener('beforeinstallprompt', handler);
		const stored = window.localStorage.getItem('install-dismissed');
		if (stored === '1') dismissed = true;
		return () => window.removeEventListener('beforeinstallprompt', handler);
	});

	async function install() {
		if (!deferred) return;
		await deferred.prompt();
		await deferred.userChoice.catch(() => undefined);
		deferred = null;
	}

	function close() {
		dismissed = true;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem('install-dismissed', '1');
		}
	}
</script>

{#if deferred && !dismissed}
	<div
		class="glass safe-bottom fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-(--color-border) p-3 shadow-lg sm:bottom-6"
	>
		<div class="grid size-10 place-items-center rounded-xl bg-(--color-accent-soft)">
			<Download size={18} />
		</div>
		<div class="flex-1 text-sm">
			<p class="font-medium">Установить приложение</p>
			<p class="text-(--color-fg-mute) text-xs">Быстрее запуск, оффлайн</p>
		</div>
		<button
			type="button"
			class="tap-target rounded-xl bg-(--color-accent) px-3 py-2 text-sm font-medium text-white active:scale-95"
			onclick={install}>Установить</button
		>
		<button
			type="button"
			class="tap-target -mr-1 rounded-full p-1 text-(--color-fg-mute)"
			aria-label="Скрыть"
			onclick={close}
		>
			<X size={16} />
		</button>
	</div>
{/if}
