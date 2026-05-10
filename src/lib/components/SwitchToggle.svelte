<script lang="ts">
	interface Props {
		/** `role="switch"` pressed state */
		pressed: boolean;
		disabled?: boolean;
		id?: string;
		'aria-labelledby'?: string;
		onFlip: () => void;
	}
	let {
		pressed,
		disabled = false,
		id,
		'aria-labelledby': ariaLabelledby,
		onFlip
	}: Props = $props();
</script>

<!-- tap-target min-h 44px would stretch the pill — wrap for hit slop, fixed 28×48 track inside -->
<span class="tap-target inline-flex shrink-0 items-center justify-center self-center">
	<button
		type="button"
		role="switch"
		aria-checked={pressed}
		aria-labelledby={ariaLabelledby}
		{id}
		class="relative box-border h-7 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full border-0 bg-transparent p-0 shadow-none outline-none ring-offset-2 ring-offset-(--color-bg) focus-visible:ring-2 focus-visible:ring-emerald-500/70 disabled:cursor-not-allowed disabled:opacity-40"
		{disabled}
		onclick={() => onFlip()}
	>
		<span
			class="absolute inset-0 transition-colors duration-200"
			class:bg-emerald-600={pressed}
			class:bg-(--color-bg-mute)={!pressed}
			class:ring-1={!pressed}
			class:ring-(--color-border)={!pressed}
			aria-hidden="true"
		></span>
		<span
			class="pointer-events-none absolute top-1/2 left-0.5 z-[1] size-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200 ease-out will-change-transform"
			class:translate-x-0={!pressed}
			class:translate-x-5={pressed}
			aria-hidden="true"
		></span>
	</button>
</span>
