<script lang="ts">
	import type { Snippet } from 'svelte';
	import PageHeadText from '$components/PageHeadText.svelte';
	import { ChevronLeft } from 'lucide-svelte';

	interface Props {
		kicker: string;
		title?: string;
		subtitle?: string;
		meta?: string;
		/**
		 * Pin to the top of the scrolling <main> with the safe-area inset.
		 * Disable only for non-scroll contexts such as the auth card.
		 */
		sticky?: boolean;
		/** Show a leading back button that calls this handler. */
		onBack?: () => void;
		backLabel?: string;
		/** Custom leading element (overrides the back button), e.g. an icon. */
		leading?: Snippet;
		showTrailing?: boolean;
		trailing?: Snippet;
		/** Extra content rendered below the title row, inside the same header. */
		children?: Snippet;
	}

	let {
		kicker,
		title,
		subtitle,
		meta,
		sticky = true,
		onBack,
		backLabel = 'Назад',
		leading,
		showTrailing = false,
		trailing,
		children
	}: Props = $props();

	const hasLeading = $derived(!!leading || !!onBack);
	const hasTrailing = $derived(showTrailing && !!trailing);
	const expand = $derived(hasLeading || hasTrailing);
</script>

<header class={sticky ? 'page-head' : 'flex flex-col gap-1'}>
	<div class="flex items-center gap-2">
		{#if leading}
			{@render leading()}
		{:else if onBack}
			<button
				type="button"
				onclick={onBack}
				class="tap-target -ml-1 grid shrink-0 place-items-center rounded-xl text-(--color-fg-mute) hover:bg-(--color-bg-mute) hover:text-(--color-fg)"
				aria-label={backLabel}
			>
				<ChevronLeft size={22} />
			</button>
		{/if}
		<PageHeadText {kicker} {title} {subtitle} {meta} {expand} />
		{#if hasTrailing}
			<div class="flex shrink-0 items-center gap-2">
				{@render trailing?.()}
			</div>
		{/if}
	</div>
	{#if children}
		<div class="mt-1">
			{@render children()}
		</div>
	{/if}
</header>
