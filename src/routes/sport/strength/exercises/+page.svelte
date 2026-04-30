<script lang="ts">
	import { strengthStore } from '$stores/strength.svelte';
	import { authStore } from '$stores/auth.svelte';
	import { toasts } from '$stores/toast.svelte';
	import {
		MUSCLE_GROUP_LABELS,
		MUSCLE_GROUP_ORDER,
		type MuscleGroup
	} from '$supabase/types';
	import { Plus, EyeOff, Eye, Trash2 } from 'lucide-svelte';
	import BackButton from '$components/BackButton.svelte';

	let newName = $state('');
	let newGroup = $state<MuscleGroup>('chest');

	const userId = $derived(authStore.user?.id ?? null);
	const own = $derived(strengthStore.exercises.filter((e) => !e.is_preset && e.user_id === userId));

	function groupLabel(raw: string | null): string {
		if (!raw) return '';
		return (MUSCLE_GROUP_LABELS as Record<string, string>)[raw] ?? raw;
	}

	async function add(event: Event) {
		event.preventDefault();
		const name = newName.trim();
		if (!name) return;
		await strengthStore.createExercise(name, newGroup);
		newName = '';
		newGroup = 'chest';
		toasts.success('Добавлено');
	}
</script>

<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 sm:pt-10">
	<header class="flex items-center gap-2">
		<BackButton fallback="/sport/strength" />
		<h1 class="text-2xl font-semibold tracking-tight">Каталог упражнений</h1>
	</header>

	<form onsubmit={add} class="hairline flex flex-col gap-3 rounded-3xl bg-(--color-bg-soft) p-3">
		<div class="grid grid-cols-[1fr_auto] gap-2">
			<input
				bind:value={newName}
				placeholder="Название"
				required
				class="rounded-xl bg-(--color-bg-mute) px-3 py-2 text-sm outline-none"
			/>
			<button
				type="submit"
				class="tap-target inline-flex items-center justify-center gap-1.5 rounded-xl bg-(--color-accent) px-3 py-2 text-sm font-medium text-white active:scale-95"
			>
				<Plus size={16} /> Создать
			</button>
		</div>
		<div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Категория">
			{#each MUSCLE_GROUP_ORDER as g (g)}
				<button
					type="button"
					onclick={() => (newGroup = g)}
					class="rounded-xl px-3 py-1.5 text-sm transition active:scale-95"
					class:bg-mute={newGroup !== g}
					class:bg-soft={newGroup === g}
					aria-pressed={newGroup === g}
				>
					{MUSCLE_GROUP_LABELS[g]}
				</button>
			{/each}
		</div>
	</form>

	<section>
		<h2 class="mb-2 px-1 text-sm font-medium text-(--color-fg-mute)">Мои упражнения</h2>
		{#if own.length === 0}
			<p
				class="hairline rounded-2xl border-dashed bg-transparent p-4 text-center text-sm text-(--color-fg-mute)"
			>
				Своих упражнений ещё нет
			</p>
		{:else}
			<ul class="hairline flex flex-col rounded-2xl bg-(--color-bg-soft)">
				{#each own as ex (ex.id)}
					<li
						class="flex items-center justify-between gap-2 px-3 py-2 not-last:border-b not-last:border-(--color-border)"
					>
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium">{ex.name}</p>
							{#if ex.muscle_group}
								<p class="text-xs text-(--color-fg-mute)">{groupLabel(ex.muscle_group)}</p>
							{/if}
						</div>
						<button
							type="button"
							class="tap-target grid size-9 place-items-center rounded-xl text-(--color-fg-mute) hover:bg-(--color-bg-mute)"
							onclick={() => strengthStore.setExerciseHidden(ex.id, !ex.hidden)}
							aria-label={ex.hidden ? 'Показать' : 'Скрыть'}
						>
							{#if ex.hidden}
								<Eye size={16} />
							{:else}
								<EyeOff size={16} />
							{/if}
						</button>
						<button
							type="button"
							class="tap-target grid size-9 place-items-center rounded-xl text-rose-400 hover:bg-rose-500/10"
							onclick={() => strengthStore.deleteExercise(ex.id)}
							aria-label="Удалить"
						>
							<Trash2 size={16} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

</div>

<style>
	.bg-mute {
		background: var(--color-bg-mute);
	}
	.bg-soft {
		background: var(--color-accent-soft);
		color: var(--color-accent);
	}
	.not-last\:border-b:not(:last-child) {
		border-bottom-width: 1px;
	}
	.not-last\:border-\(--color-border\):not(:last-child) {
		border-color: var(--color-border);
	}
</style>
