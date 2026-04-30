<script lang="ts">
	import { toasts } from '$stores/toast.svelte';
	import { fly } from 'svelte/transition';
	import { CheckCircle2, AlertCircle, Info, X } from 'lucide-svelte';
</script>

<div
	class="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-3"
	style="padding-top: calc(env(safe-area-inset-top) + 0.5rem);"
	role="region"
	aria-live="polite"
>
	{#each toasts.items as t (t.id)}
		<div
			in:fly={{ y: -12, duration: 180 }}
			out:fly={{ y: -12, duration: 140 }}
			class="glass pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-(--color-border) px-4 py-3 text-sm shadow-lg"
		>
			{#if t.kind === 'success'}
				<CheckCircle2 size={18} class="text-emerald-400" />
			{:else if t.kind === 'error'}
				<AlertCircle size={18} class="text-rose-400" />
			{:else}
				<Info size={18} class="text-sky-400" />
			{/if}
			<p class="flex-1">{t.message}</p>
			<button
				type="button"
				class="tap-target -mr-2 rounded-full p-1 text-(--color-fg-mute) hover:text-(--color-fg)"
				aria-label="Скрыть"
				onclick={() => toasts.dismiss(t.id)}
			>
				<X size={16} />
			</button>
		</div>
	{/each}
</div>
