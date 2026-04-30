<script lang="ts">
	import { Minus, Plus, Check, Loader2 } from 'lucide-svelte';

	interface Props {
		disabled?: boolean;
		onsubmit: (input: { weight: number; reps: number }) => Promise<void>;
		initialWeight?: number;
		initialReps?: number;
	}

	import { untrack } from 'svelte';

	let { disabled = false, onsubmit, initialWeight = 60, initialReps = 8 }: Props = $props();

	let weight = $state(untrack(() => initialWeight));
	let reps = $state(untrack(() => initialReps));
	let saving = $state(false);

	function bumpWeight(delta: number) {
		weight = Math.max(0, Math.round((weight + delta) * 10) / 10);
	}
	function bumpReps(delta: number) {
		reps = Math.max(1, reps + delta);
	}

	async function submit(event: Event) {
		event.preventDefault();
		if (disabled || saving) return;
		saving = true;
		try {
			await onsubmit({ weight, reps });
		} finally {
			saving = false;
		}
	}
</script>

<form onsubmit={submit} class="flex flex-col gap-3">
	<div class="grid grid-cols-2 gap-3">
		<div class="flex min-w-0 flex-col gap-1">
			<span class="block text-xs font-medium uppercase tracking-wide text-(--color-fg-mute)"
				>Вес</span
			>
			<div class="stepper hairline rounded-2xl bg-(--color-bg-mute) p-1">
				<button
					type="button"
					class="stepper-btn"
					onclick={() => bumpWeight(-2.5)}
					aria-label="-2.5"
				>
					<Minus size={16} />
				</button>
				<input
					type="number"
					inputmode="decimal"
					step="0.5"
					min="0"
					bind:value={weight}
					class="w-full min-w-0 bg-transparent px-1 text-center text-lg font-semibold tabular-nums outline-none"
				/>
				<button
					type="button"
					class="stepper-btn"
					onclick={() => bumpWeight(2.5)}
					aria-label="+2.5"
				>
					<Plus size={16} />
				</button>
			</div>
		</div>

		<div class="flex min-w-0 flex-col gap-1">
			<span class="block text-xs font-medium uppercase tracking-wide text-(--color-fg-mute)"
				>Повторения</span
			>
			<div class="stepper hairline rounded-2xl bg-(--color-bg-mute) p-1">
				<button type="button" class="stepper-btn" onclick={() => bumpReps(-1)} aria-label="-1">
					<Minus size={16} />
				</button>
				<input
					type="number"
					inputmode="numeric"
					step="1"
					min="1"
					bind:value={reps}
					class="w-full min-w-0 bg-transparent px-1 text-center text-lg font-semibold tabular-nums outline-none"
				/>
				<button type="button" class="stepper-btn" onclick={() => bumpReps(1)} aria-label="+1">
					<Plus size={16} />
				</button>
			</div>
		</div>
	</div>

	<button
		type="submit"
		disabled={disabled || saving}
		class="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-(--color-accent) px-4 text-sm font-medium text-white transition active:scale-[0.99] disabled:opacity-60"
	>
		{#if saving}
			<Loader2 size={16} class="animate-spin" />
		{:else}
			<Check size={16} />
		{/if}
		<span>Записать подход</span>
	</button>
</form>

<style>
	.stepper {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr) 40px;
		align-items: center;
		gap: 4px;
	}

	.stepper-btn {
		display: grid;
		place-items: center;
		height: 40px;
		width: 40px;
		border-radius: 12px;
		background: var(--color-bg-soft);
		transition: transform 0.1s ease;
	}

	.stepper-btn:active {
		transform: scale(0.92);
	}

	.stepper-btn:hover {
		background: var(--color-bg);
	}

	@media (min-width: 380px) {
		.stepper {
			grid-template-columns: 44px minmax(0, 1fr) 44px;
		}

		.stepper-btn {
			height: 44px;
			width: 44px;
		}
	}
</style>
