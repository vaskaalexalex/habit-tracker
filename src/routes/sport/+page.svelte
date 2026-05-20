<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import PageHeader from '$components/PageHeader.svelte';
	import { Dumbbell, HeartPulse, ListChecks, ChevronRight } from 'lucide-svelte';
	import { todayStore } from '$stores/today.svelte';
	import { strengthStore } from '$stores/strength.svelte';
	import { cardioStore } from '$stores/cardio.svelte';
	import {
		dayScopeBadge,
		dayScopeLabel,
		resolveViewDate,
		withViewDate
	} from '$lib/nav/view-date';

	const today = $derived(todayStore.today);
	const viewDate = $derived(resolveViewDate($page.url.searchParams, today));

	$effect(() => {
		const raw = $page.url.searchParams.get('date');
		if (raw && raw === today) {
			void goto(`${base}/sport`, { replaceState: true, keepFocus: true, noScroll: true });
		}
	});

	const hasStrengthOnDay = $derived(strengthStore.setsForDate(viewDate).length > 0);
	const hasCardioOnDay = $derived(cardioStore.items.some((c) => c.date === viewDate));

	const workoutsOnDay = $derived((hasStrengthOnDay ? 1 : 0) + (hasCardioOnDay ? 1 : 0));

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
			path: `${base}/sport/strength`,
			label: 'Силовая',
			desc: 'подходы, прогресс',
			icon: Dumbbell,
			color: 'var(--color-sport)',
			gradient: 'from-orange-500/30 to-rose-500/10',
			count: hasStrengthOnDay ? 1 : 0
		},
		{
			path: `${base}/sport/cardio`,
			label: 'Другая',
			desc: 'зарядка, бег, плавание',
			icon: HeartPulse,
			color: 'var(--color-coding)',
			gradient: 'from-emerald-500/30 to-teal-500/10',
			count: hasCardioOnDay ? 1 : 0
		}
	]);

	const exercisesPath = `${base}/sport/strength/exercises`;

	function openCatalog(event: MouseEvent) {
		event.preventDefault();
		const cur = `${$page.url.pathname}${$page.url.search}`;
		if (cur === exercisesPath) return;
		void goto(exercisesPath);
	}

	function openTile(path: string) {
		const href = withViewDate(path, viewDate, today);
		const cur = `${$page.url.pathname}${$page.url.search}`;
		if (cur === href) return;
		void goto(href);
	}
</script>

<div class="page-shell">
	<PageHeader
		kicker="Тренировки"
		title="Спорт"
		subtitle="{dayScopeLabel(viewDate, today)}: {workoutsOnDay} {trainingsWord(workoutsOnDay)}"
		showTrailing={true}
	>
		{#snippet trailing()}
			<a
				href={exercisesPath}
				onclick={openCatalog}
				class="tap-target inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-(--color-border) bg-(--color-bg-soft) px-3 py-2 text-xs font-bold uppercase tracking-wide sm:text-sm"
			>
				<ListChecks size={16} />
				<span>Каталог</span>
			</a>
		{/snippet}
	</PageHeader>

	<section class="@container grid grid-cols-1 gap-3 @[30rem]:grid-cols-2">
		{#each tiles as tile (tile.path)}
			<button
				type="button"
				onclick={() => openTile(tile.path)}
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
									{tile.count} {dayScopeBadge(viewDate, today)}
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
