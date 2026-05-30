<script module lang="ts">
	import type { ComponentType } from 'svelte';

	/** lucide-svelte icons are legacy class components, hence `ComponentType`. */
	export type DropdownIcon = ComponentType;

	export interface DropdownOption {
		value: string;
		label: string;
		icon?: DropdownIcon;
		/** Optional leading colour dot (Tailwind bg class), e.g. priority indicator. */
		dotClass?: string;
	}
</script>

<script lang="ts">
	import { ChevronDown, Check } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		options: DropdownOption[];
		value: string | null;
		onChange: (value: string) => void;
		placeholder?: string;
		ariaLabel?: string;
		compact?: boolean;
		/** Stretch trigger to fill its container. */
		block?: boolean;
	}

	let {
		options,
		value,
		onChange,
		placeholder = 'Выбрать',
		ariaLabel,
		compact = false,
		block = false
	}: Props = $props();

	let open = $state(false);
	let rootEl = $state<HTMLDivElement | null>(null);
	let alignRight = $state(false);

	const selected = $derived(options.find((o) => o.value === value) ?? null);

	$effect(() => {
		if (!open || !rootEl) return;
		const r = rootEl.getBoundingClientRect();
		alignRight = r.left + r.width / 2 > window.innerWidth / 2;
	});

	$effect(() => {
		if (!open) return;
		function onDocClick(e: MouseEvent) {
			if (rootEl && !rootEl.contains(e.target as Node)) open = false;
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') open = false;
		}
		document.addEventListener('mousedown', onDocClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDocClick);
			document.removeEventListener('keydown', onKey);
		};
	});

	function pick(v: string) {
		onChange(v);
		open = false;
	}
</script>

<div class="relative {block ? 'w-full' : 'inline-block'}" bind:this={rootEl}>
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={ariaLabel}
		class="hairline flex w-full items-center justify-between gap-2 rounded-xl bg-(--color-bg-mute) px-3 text-left {compact
			? 'py-1.5 text-sm'
			: 'tap-target py-2.5'}"
	>
		<span class="flex min-w-0 items-center gap-2">
			{#if selected?.dotClass}
				<span class="size-2 shrink-0 rounded-full {selected.dotClass}"></span>
			{/if}
			{#if selected?.icon}
				{@const Icon = selected.icon}
				<Icon size={16} class="shrink-0 text-(--color-fg-mute)" />
			{/if}
			<span class="truncate {selected ? '' : 'text-(--color-fg-mute)'}">
				{selected ? selected.label : placeholder}
			</span>
		</span>
		<ChevronDown
			size={16}
			class="shrink-0 text-(--color-fg-mute) transition-transform duration-150 {open
				? 'rotate-180'
				: ''}"
			aria-hidden="true"
		/>
	</button>

	{#if open}
		<div
			role="listbox"
			class="hairline absolute z-30 mt-2 flex max-h-[min(20rem,calc(100dvh-9rem))] w-[min(16rem,calc(100vw-2rem))] flex-col overflow-y-auto overscroll-contain rounded-2xl bg-(--color-bg-soft) py-1 shadow-xl"
			class:left-0={!alignRight}
			class:right-0={alignRight}
			in:fly={{ y: -4, duration: 120 }}
		>
			{#each options as opt (opt.value)}
				<button
					type="button"
					role="option"
					aria-selected={opt.value === value}
					onclick={() => pick(opt.value)}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-(--color-bg-mute)"
				>
					{#if opt.dotClass}
						<span class="size-2 shrink-0 rounded-full {opt.dotClass}"></span>
					{/if}
					{#if opt.icon}
						{@const Icon = opt.icon}
						<Icon size={16} class="shrink-0 text-(--color-fg-mute)" />
					{/if}
					<span class="min-w-0 flex-1 truncate">{opt.label}</span>
					{#if opt.value === value}
						<Check size={14} class="shrink-0 text-(--color-accent)" />
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
