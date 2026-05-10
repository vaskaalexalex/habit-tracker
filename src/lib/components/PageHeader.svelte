<script lang="ts">
	import type { Snippet } from 'svelte';
	import PageHeadText from '$components/PageHeadText.svelte';

	interface Props {
		kicker: string;
		title: string;
		subtitle?: string;
		meta?: string;
		showTrailing?: boolean;
		trailing?: Snippet;
	}

	let {
		kicker,
		title,
		subtitle,
		meta,
		showTrailing = false,
		trailing
	}: Props = $props();

	const expand = $derived(showTrailing);
</script>

<header class="flex items-center gap-2">
	<PageHeadText {kicker} {title} {subtitle} {meta} {expand} />
	{#if showTrailing && trailing}
		<div class="flex shrink-0 items-center gap-2">
			{@render trailing()}
		</div>
	{/if}
</header>
