<script lang="ts">
	import { Search, Plus, Check, X } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import type { Exercise, MuscleGroup } from '$supabase/types';
	import { MUSCLE_GROUP_LABELS, MUSCLE_GROUP_ORDER } from '$supabase/types';

	interface Props {
		exercises: Exercise[];
		value: string | null;
		onselect: (id: string) => void;
		oncreate?: (name: string) => void | Promise<void>;
		placeholder?: string;
		compact?: boolean;
		/** Limit list to this muscle group (e.g. row in «Грудь»). No group chip row in the panel. */
		groupFilter?: MuscleGroup | null;
	}

	let {
		exercises,
		value,
		onselect,
		oncreate,
		placeholder = 'Выбери упражнение',
		compact = false,
		groupFilter = null
	}: Props = $props();

	const GROUP_LABELS = MUSCLE_GROUP_LABELS;
	const GROUP_ORDER = MUSCLE_GROUP_ORDER;

	let open = $state(false);
	let query = $state('');
	let inputEl = $state<HTMLInputElement | null>(null);
	let rootEl = $state<HTMLDivElement | null>(null);
	let alignRight = $state(false);
	/** When no row-level groupFilter: narrow list by muscle */
	let chipFilter = $state<MuscleGroup | 'all'>('all');

	function normalizeMuscle(raw: string | null): MuscleGroup {
		if (raw === 'shoulders') return 'arms';
		const r = raw ?? 'other';
		return (MUSCLE_GROUP_ORDER as readonly string[]).includes(r) ? (r as MuscleGroup) : 'other';
	}

	function compareExercises(a: Exercise, b: Exercise): number {
		const ao = a.sort_order ?? 10_000;
		const bo = b.sort_order ?? 10_000;
		if (ao !== bo) return ao - bo;
		return a.name.localeCompare(b.name, 'ru');
	}

	$effect(() => {
		if (open && inputEl) requestAnimationFrame(() => inputEl?.focus());
	});

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
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});

	$effect(() => {
		groupFilter;
		chipFilter = 'all';
	});

	const selected = $derived(exercises.find((e) => e.id === value) ?? null);

	const filtered = $derived(
		exercises.filter((e) => {
			if (e.hidden) return false;
			if (!e.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
			const g = normalizeMuscle(e.muscle_group);

			if (groupFilter) {
				return g === groupFilter;
			}

			if (chipFilter !== 'all' && g !== chipFilter) return false;
			return true;
		})
	);

	const grouped = $derived.by(() => {
		const m = new Map<string, Exercise[]>();
		for (const ex of filtered) {
			const g = normalizeMuscle(ex.muscle_group);
			const arr = m.get(g) ?? [];
			arr.push(ex);
			m.set(g, arr);
		}
		for (const arr of m.values()) arr.sort(compareExercises);
		return m;
	});

	const canCreate = $derived(
		!!oncreate &&
			query.trim().length > 1 &&
			!exercises.some((e) => e.name.toLowerCase() === query.trim().toLowerCase())
	);

	function pick(id: string) {
		onselect(id);
		open = false;
		query = '';
	}

	async function createNew() {
		if (!oncreate) return;
		const name = query.trim();
		if (!name) return;
		await oncreate(name);
		open = false;
		query = '';
	}
</script>

<div class="relative" bind:this={rootEl}>
	<button
		type="button"
		onclick={() => (open = !open)}
		class="hairline flex w-full items-center justify-between gap-2 rounded-xl bg-(--color-bg-mute) px-3 text-left {compact
			? 'py-1.5 text-sm'
			: 'tap-target py-2.5'}"
	>
		<span class="truncate {selected ? '' : 'text-(--color-fg-mute)'}">
			{selected ? selected.name : placeholder}
		</span>
		<Search size={14} class="shrink-0 text-(--color-fg-mute)" />
	</button>

	{#if open}
		<div
			class="hairline absolute z-30 mt-2 flex max-h-[min(22rem,calc(100dvh-9rem))] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-(--color-bg-soft) shadow-xl"
			class:left-0={!alignRight}
			class:right-0={alignRight}
			in:fly={{ y: -4, duration: 120 }}
		>
			<div class="flex shrink-0 items-center gap-1 border-b border-(--color-border) p-2">
				<input
					bind:this={inputEl}
					type="text"
					bind:value={query}
					placeholder={oncreate ? 'Поиск или создать…' : 'Поиск…'}
					class="flex-1 rounded-xl bg-(--color-bg-mute) px-3 py-2 text-sm outline-none"
				/>
				{#if query}
					<button
						type="button"
						onclick={() => (query = '')}
						class="grid size-8 place-items-center rounded-lg text-(--color-fg-mute) hover:bg-(--color-bg-mute)"
						aria-label="Очистить"
					>
						<X size={14} />
					</button>
				{/if}
			</div>

			{#if !groupFilter}
				<div class="flex shrink-0 flex-wrap gap-1 border-b border-(--color-border) px-2 py-2" role="radiogroup" aria-label="Группа мышц">
					<button
						type="button"
						onclick={() => (chipFilter = 'all')}
						class="rounded-full px-2.5 py-1 text-xs font-medium transition"
						class:bg-(--color-accent)={chipFilter === 'all'}
						class:text-white={chipFilter === 'all'}
						class:bg-(--color-bg-mute)={chipFilter !== 'all'}
					>
						Все
					</button>
					{#each GROUP_ORDER as g (g)}
						<button
							type="button"
							onclick={() => (chipFilter = g)}
							class="rounded-full px-2.5 py-1 text-xs font-medium transition"
							class:bg-(--color-accent)={chipFilter === g}
							class:text-white={chipFilter === g}
							class:bg-(--color-bg-mute)={chipFilter !== g}
							aria-pressed={chipFilter === g}
						>
							{GROUP_LABELS[g]}
						</button>
					{/each}
				</div>
			{/if}

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
				{#each GROUP_ORDER as g (g)}
					{@const list = grouped.get(g) ?? []}
					{#if list.length > 0}
						<div class="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-(--color-fg-mute)">
							{GROUP_LABELS[g]}
						</div>
						{#each list as ex (ex.id)}
							<button
								type="button"
								onclick={() => pick(ex.id)}
								class="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-(--color-bg-mute)"
							>
								<span class="flex-1 truncate">{ex.name}</span>
								{#if ex.id === value}
									<Check size={14} class="text-(--color-accent)" />
								{/if}
							</button>
						{/each}
					{/if}
				{/each}
				{#if filtered.length === 0 && !canCreate}
					<p class="px-3 py-3 text-sm text-(--color-fg-mute)">Ничего не найдено</p>
				{/if}
				{#if canCreate}
					<button
						type="button"
						onclick={createNew}
						class="flex w-full items-center gap-2 border-t border-(--color-border) px-3 py-2 text-left text-sm text-(--color-accent) hover:bg-(--color-bg-mute)"
					>
						<Plus size={14} />
						Создать «{query.trim()}»
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
