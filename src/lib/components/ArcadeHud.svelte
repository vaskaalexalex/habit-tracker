<script lang="ts">
	import { gameStore } from '$stores/game.svelte';
	import { Coins, Heart, Swords } from 'lucide-svelte';

	const segments = 16;
	const segIdx = Array.from({ length: segments }, (_, i) => i);
	const filled = $derived(
		Math.round((gameStore.xpIntoLevel / gameStore.xpForNextLevel) * segments)
	);
</script>

<div class="hairline flex items-center gap-3 bg-(--color-bg-soft) p-3">
	<div
		class="grid size-12 shrink-0 place-items-center border-2 border-(--color-fg) bg-(--color-bg-mute) text-(--color-accent)"
	>
		<Swords size={22} />
	</div>
	<div class="min-w-0 flex-1">
		<div class="mb-1 flex items-center justify-between gap-2">
			<span class="font-display text-sm tracking-wide text-(--color-fg)">LVL {gameStore.level}</span
			>
			<span class="inline-flex items-center gap-2 text-sm tabular-nums">
				<span class="inline-flex items-center gap-1 text-(--color-journal)">
					<Coins size={13} />
					{gameStore.coins}
				</span>
				<span class="inline-flex items-center gap-0.5 text-(--color-danger)">
					<Heart size={12} fill="currentColor" />
					<Heart size={12} fill="currentColor" />
					<Heart size={12} fill="currentColor" />
				</span>
			</span>
		</div>
		<div class="flex gap-px" aria-hidden="true">
			{#each segIdx as i (i)}
				<span
					class="h-3 flex-1"
					style="background: {i < filled
						? 'var(--color-accent)'
						: 'var(--color-bg-mute)'}; box-shadow: inset 0 0 0 1px var(--color-fg-faint);"
				></span>
			{/each}
		</div>
		<div class="mt-1 text-xs tabular-nums text-(--color-fg-mute)">
			XP {gameStore.xpIntoLevel}/{gameStore.xpForNextLevel}
		</div>
	</div>
</div>
