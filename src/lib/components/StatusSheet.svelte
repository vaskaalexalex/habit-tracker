<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { Check } from 'lucide-svelte';
	import { TASK_STATUS_ORDER, type TaskStatus } from '$supabase/types';
	import { STATUS_META } from '$lib/tasks/status-meta';

	interface Props {
		open: boolean;
		current: TaskStatus | null;
		title?: string;
		onSelect: (status: TaskStatus) => void;
		onClose: () => void;
	}

	let { open, current, title = 'Статус задачи', onSelect, onClose }: Props = $props();

	function choose(status: TaskStatus) {
		onSelect(status);
		onClose();
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<button
			type="button"
			class="absolute inset-0 bg-black/50"
			aria-label="Закрыть"
			onclick={onClose}
			transition:fade={{ duration: 120 }}
		></button>

		<div
			class="hairline relative z-10 mx-3 mb-3 w-full max-w-sm rounded-3xl bg-(--color-bg-soft) p-2 shadow-2xl sm:mb-0"
			style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));"
			in:fly={{ y: 16, duration: 160 }}
			out:fly={{ y: 16, duration: 120 }}
		>
			<p
				class="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-(--color-fg-mute)"
			>
				{title}
			</p>
			{#each TASK_STATUS_ORDER as status (status)}
				{@const meta = STATUS_META[status]}
				{@const Icon = meta.icon}
				<button
					type="button"
					onclick={() => choose(status)}
					class="tap-target flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-(--color-bg-mute)"
				>
					<Icon size={20} class={meta.colorClass} />
					<span class="flex-1 text-sm font-medium">{meta.label}</span>
					{#if status === current}
						<Check size={16} class="text-(--color-accent)" />
					{/if}
				</button>
			{/each}
		</div>
	</div>
{/if}
