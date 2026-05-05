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
		/** Limit list to this muscle group (e.g. row in «Грудь»). User can expand via chips. */
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
	/** When parent passes groupFilter: false = only that group; true = full catalog + chips */
	let expandAllGroups = $state(false);
	/** When no row-level groupFilter: narrow list by muscle */
	let chipFilter = $state<MuscleGroup | 'all'>('all');

	function normalizeMuscle(raw: string | null): MuscleGroup {
		const r = raw ?? 'other';
		return (MUSCLE_GROUP_ORDER as readonly string[]).includes(r) ? (r as MuscleGroup) : 'other';
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

	// New row scope → start collapsed to that group again
	$effect(() => {
		groupFilter;
		expandAllGroups = false;
		chipFilter = 'all';
	});

	const selected = $derived(exercises.find((e) => e.id === value) ?? null);

	const filtered = $derived(
		exercises.filter((e) => {
			if (e.hidden) return false;
			if (!e.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
			const g = normalizeMuscle(e.muscle_group);

			if (groupFilter && !expandAllGroups) {
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
		for (const arr of m.values()) arr.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
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
			class="hairline absolute z-30 mt-2 max-h-80 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-(--color-bg-soft) shadow-xl"
			class:left-0={!alignRight}
			class:right-0={alignRight}
			in:fly={{ y: -4, duration: 120 }}
		>
			<div class="flex items-center gap-1 border-b border-(--color-border) p-2">
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

			<div class="flex flex-wrap gap-1 border-b border-(--color-border) px-2 py-2" role="radiogroup" aria-label="Группа мышц">
				{#if groupFilter && !expandAllGroups}
					<button
						type="button"
						disabled
						class="rounded-full bg-(--color-accent) px-2.5 py-1 text-xs font-medium text-white opacity-90"
					>
						{GROUP_LABELS[groupFilter]}
					</button>
					<button
						type="button"
						onclick={() => {
							expandAllGroups = true;
							chipFilter = groupFilter;
						}}
						class="rounded-full bg-(--color-bg-mute) px-2.5 py-1 text-xs font-medium text-(--color-fg) hover:bg-(--color-bg-soft)"
					>
						Все группы
					</button>
				{:else}
					{#if groupFilter && expandAllGroups}
						<button
							type="button"
							onclick={() => {
								expandAllGroups = false;
								chipFilter = 'all';
							}}
							class="rounded-full bg-(--color-bg-mute) px-2 py-1 text-[11px] font-medium text-(--color-fg-mute) hover:text-(--color-fg)"
						>
							← только «{GROUP_LABELS[groupFilter]}»
						</button>
					{/if}
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
				{/if}
			</div>

			<div class="max-h-64 overflow-y-auto py-1">
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
