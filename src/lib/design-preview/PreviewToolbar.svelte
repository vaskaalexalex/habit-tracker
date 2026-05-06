<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	const VARIANTS = [
		{ id: 1, name: 'Clinical Minimal', note: 'Список, воздух, тонкая сетка активности' },
		{ id: 2, name: 'Bold Dashboard', note: 'Табло даты + KPI + bento-сетка' },
		{ id: 3, name: 'Glass OS', note: 'Острова blur-панелей' },
		{ id: 4, name: 'Paper Journal', note: '«Бумага», serif-заголовок' },
		{ id: 5, name: 'Sport Neon', note: 'Спорт-герой + неон и glow' }
	] as const;

	interface Props {
		variant: number;
	}

	let { variant }: Props = $props();

	function setVariant(v: number) {
		void goto(`${base}/design-preview?v=${v}`, { replaceState: true, noScroll: true });
	}
</script>

<div
	class="hairline mb-4 flex shrink-0 flex-col gap-2 rounded-2xl bg-(--color-bg-soft) p-3 sm:flex-row sm:items-center sm:justify-between"
>
	<p class="text-xs font-medium text-(--color-fg-mute)">Композиции (моки)</p>
	<div class="flex flex-wrap gap-1.5">
		{#each VARIANTS as v (v.id)}
			<button
				type="button"
				class="tap-target rounded-xl px-2.5 py-1.5 text-xs font-medium transition active:scale-[0.98] {variant ===
				v.id
					? 'bg-(--color-accent) text-white'
					: 'bg-(--color-bg-mute) text-(--color-fg)'}"
				onclick={() => setVariant(v.id)}
			>
				{v.id}. {v.name}
			</button>
		{/each}
	</div>
</div>

<p class="mb-4 text-xs text-(--color-fg-mute)">{VARIANTS[variant - 1]?.note ?? ''}</p>
