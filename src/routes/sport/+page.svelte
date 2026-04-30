<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { Dumbbell, HeartPulse, ListChecks, ChevronRight } from 'lucide-svelte';
	import { isoToday } from '$utils/dates';
	import { strengthStore } from '$stores/strength.svelte';
	import { cardioStore } from '$stores/cardio.svelte';

	const today = $derived(isoToday());
	const strengthCount = $derived(strengthStore.setsForDate(today).length);
	const cardioToday = $derived(cardioStore.items.filter((c) => c.date === today).length);

	const tiles = $derived([
		{
			href: `${base}/sport/strength`,
			label: 'Силовая',
			desc: 'подходы, прогресс',
			icon: Dumbbell,
			color: 'var(--color-sport)',
			gradient: 'from-orange-500/30 to-rose-500/10',
			count: strengthCount
		},
		{
			href: `${base}/sport/cardio`,
			label: 'Другая',
			desc: 'зарядка, бег, плавание',
			icon: HeartPulse,
			color: 'var(--color-coding)',
			gradient: 'from-emerald-500/30 to-teal-500/10',
			count: cardioToday
		}
	]);

	function openCatalog(event: MouseEvent) {
		event.preventDefault();
		void goto(`${base}/sport/strength/exercises`);
	}
</script>

<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 sm:pt-10">
	<header class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Спорт</h1>
			<p class="mt-1 text-sm text-(--color-fg-mute)">
				Сегодня: {strengthCount + cardioToday} запис(ей)
			</p>
		</div>
		<a
			href={`${base}/sport/strength/exercises`}
			onclick={openCatalog}
			class="tap-target inline-flex items-center gap-1.5 rounded-2xl border border-(--color-border) bg-(--color-bg-soft) px-3 py-2 text-sm"
		>
			<ListChecks size={16} />
			<span>Каталог</span>
		</a>
	</header>

	<section class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		{#each tiles as tile (tile.href)}
			<button
				type="button"
				onclick={() => goto(tile.href)}
				class="hairline group relative flex h-32 items-center overflow-hidden rounded-3xl bg-(--color-bg-soft) p-4 text-left transition active:scale-[0.99]"
			>
				<div
					class="bg-gradient-to-br pointer-events-none absolute inset-0 opacity-60 {tile.gradient}"
				></div>
				<div class="relative flex w-full items-center gap-3">
					<div
						class="grid size-12 place-items-center rounded-2xl"
						style="background: color-mix(in oklch, {tile.color} 22%, transparent); color: {tile.color};"
					>
						<tile.icon size={22} />
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<h3 class="text-lg font-semibold tracking-tight">{tile.label}</h3>
							{#if tile.count > 0}
								<span
									class="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400 tabular-nums"
								>
									{tile.count} сегодня
								</span>
							{/if}
						</div>
						<p class="truncate text-sm text-(--color-fg-mute)">{tile.desc}</p>
					</div>
					<ChevronRight
						size={18}
						class="text-(--color-fg-mute) transition group-hover:translate-x-0.5"
					/>
				</div>
			</button>
		{/each}
	</section>
</div>
