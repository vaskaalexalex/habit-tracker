<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import PageHeader from '$components/PageHeader.svelte';
	import { Dumbbell, HeartPulse, ListChecks, ChevronRight } from 'lucide-svelte';
	import { todayStore } from '$stores/today.svelte';
	import { strengthStore } from '$stores/strength.svelte';
	import { cardioStore } from '$stores/cardio.svelte';

	const today = $derived(todayStore.today);

	/** Одна «тренировка» за день по типу: силовая или кардио, не число подходов/записей. */
	const hasStrengthToday = $derived(strengthStore.setsForDate(today).length > 0);
	const hasCardioToday = $derived(cardioStore.items.some((c) => c.date === today));

	const workoutsToday = $derived((hasStrengthToday ? 1 : 0) + (hasCardioToday ? 1 : 0));

	function trainingsWord(n: number): string {
		const n100 = n % 100;
		const n10 = n % 10;
		if (n100 >= 11 && n100 <= 14) return 'тренировок';
		if (n10 === 1) return 'тренировка';
		if (n10 >= 2 && n10 <= 4) return 'тренировки';
		return 'тренировок';
	}

	const tiles = $derived([
		{
			href: `${base}/sport/strength`,
			label: 'Силовая',
			desc: 'подходы, прогресс',
			icon: Dumbbell,
			color: 'var(--color-sport)',
			gradient: 'from-orange-500/30 to-rose-500/10',
			count: hasStrengthToday ? 1 : 0
		},
		{
			href: `${base}/sport/cardio`,
			label: 'Другая',
			desc: 'зарядка, бег, плавание',
			icon: HeartPulse,
			color: 'var(--color-coding)',
			gradient: 'from-emerald-500/30 to-teal-500/10',
			count: hasCardioToday ? 1 : 0
		}
	]);

	function openCatalog(event: MouseEvent) {
		event.preventDefault();
		void goto(`${base}/sport/strength/exercises`);
	}
</script>

<div class="page-shell">
	<PageHeader
		kicker="Тренировки"
		title="Спорт"
		subtitle="Сегодня: {workoutsToday} {trainingsWord(workoutsToday)}"
		showTrailing={true}
	>
		{#snippet trailing()}
			<a
				href={`${base}/sport/strength/exercises`}
				onclick={openCatalog}
				class="tap-target inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-(--color-border) bg-(--color-bg-soft) px-3 py-2 text-xs font-bold uppercase tracking-wide sm:text-sm"
			>
				<ListChecks size={16} />
				<span>Каталог</span>
			</a>
		{/snippet}
	</PageHeader>

	<section class="@container grid grid-cols-1 gap-3 @[30rem]:grid-cols-2">
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
						<div class="flex min-w-0 items-center gap-2">
							<h3 class="min-w-0 truncate text-lg font-bold tracking-tight">{tile.label}</h3>
							{#if tile.count > 0}
								<span
									class="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400 tabular-nums"
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
