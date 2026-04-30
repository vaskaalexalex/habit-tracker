<script lang="ts">
	import { goto } from '$app/navigation';
	import { ChevronLeft } from 'lucide-svelte';

	interface Props {
		fallback: string;
	}

	let { fallback }: Props = $props();

	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		} else {
			void goto(fallback);
		}
	}
</script>

<button
	type="button"
	onclick={goBack}
	class="tap-target grid size-9 place-items-center rounded-2xl border border-(--color-border) bg-(--color-bg-soft)"
	aria-label="Назад"
>
	<ChevronLeft size={18} />
</button>
