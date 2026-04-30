<script lang="ts">
	import { strengthStore } from '$stores/strength.svelte';
	import { ensureSportNotCompletedIfEmpty } from '$stores/auto-complete';
	import { Trash2 } from 'lucide-svelte';
	import { fly } from 'svelte/transition';
	import type { ISODate, WorkoutSet } from '$supabase/types';

	interface Props {
		date: ISODate;
	}

	let { date }: Props = $props();

	async function handleDelete(set: WorkoutSet) {
		await strengthStore.deleteSet(set.id);
		await ensureSportNotCompletedIfEmpty(set.date);
	}

	const setsToday = $derived(strengthStore.setsForDate(date));

	const grouped = $derived.by(() => {
		const map = new Map<string, WorkoutSet[]>();
		for (const s of setsToday) {
			const arr = map.get(s.exercise_id) ?? [];
			arr.push(s);
			map.set(s.exercise_id, arr);
		}
		for (const arr of map.values()) arr.sort((a, b) => a.set_number - b.set_number);
		return [...map.entries()].map(([exerciseId, sets]) => ({
			exerciseId,
			sets,
			name: strengthStore.exercises.find((e) => e.id === exerciseId)?.name ?? '—'
		}));
	});

	function totalVolume(sets: WorkoutSet[]): number {
		return Math.round(sets.reduce((acc, s) => acc + s.weight * s.reps, 0));
	}
</script>

{#if setsToday.length === 0}
	<div
		class="hairline rounded-2xl border-dashed bg-transparent p-6 text-center text-sm text-(--color-fg-mute)"
	>
		Сегодня подходов ещё нет. Добавь первый.
	</div>
{:else}
	<div class="flex flex-col gap-3">
		{#each grouped as g (g.exerciseId)}
			<div class="hairline rounded-2xl bg-(--color-bg-soft) p-3" in:fly={{ y: 4, duration: 140 }}>
				<div class="mb-2 flex items-center justify-between">
					<h4 class="font-medium">{g.name}</h4>
					<span class="text-xs text-(--color-fg-mute)">{totalVolume(g.sets)} кг·повт</span>
				</div>
				<ul class="flex flex-wrap gap-1.5">
					{#each g.sets as set (set.id)}
						<li
							class="inline-flex items-center gap-1 rounded-xl bg-(--color-bg-mute) px-2.5 py-1 text-sm tabular-nums"
						>
							<span>{set.weight}×{set.reps}</span>
							<button
								type="button"
								onclick={() => handleDelete(set)}
								class="tap-target ml-1 grid size-5 place-items-center rounded-md text-(--color-fg-mute) hover:text-rose-400"
								aria-label="Удалить подход"
							>
								<Trash2 size={12} />
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
{/if}
