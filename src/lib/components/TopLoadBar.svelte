<script lang="ts">
	interface Props {
		active?: boolean;
	}

	let { active = false }: Props = $props();
</script>

{#if active}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-[48] flex flex-col"
		aria-hidden="true"
	>
		<div class="shrink-0" style="height: env(safe-area-inset-top, 0px);"></div>
		<div class="h-[3px] w-full overflow-hidden bg-(--color-bg-mute)">
			<div class="bootstrap-load-bar__stripe"></div>
		</div>
	</div>
{/if}
