<script lang="ts">
	interface Props {
		kicker: string;
		title: string;
		subtitle?: string;
		meta?: string;
		/** When true, column grows in flex row (back button + title + actions). */
		expand?: boolean;
	}

	let { kicker, title, subtitle, meta, expand = false }: Props = $props();
</script>

<div class="flex min-w-0 flex-col gap-1" class:flex-1={expand}>
	<p class="page-kicker">{kicker}</p>
	<h1 class="page-title">{title}</h1>
	{#if subtitle}
		<p class="page-subtitle">{subtitle}</p>
	{/if}
	{#if meta}
		<p class="page-meta">{meta}</p>
	{/if}
</div>
