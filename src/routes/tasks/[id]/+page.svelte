<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { ChevronLeft, Trash2, Plus, AlarmClock } from 'lucide-svelte';
	import { tasksStore } from '$stores/tasks.svelte';
	import { todayStore } from '$stores/today.svelte';
	import Dropdown, { type DropdownOption } from '$components/Dropdown.svelte';
	import { STATUS_META, PRIORITY_META } from '$lib/tasks/status-meta';
	import { deadlineState, deadlineLabel } from '$lib/tasks/deadline';
	import {
		TASK_PRIORITY_ORDER,
		TASK_STATUS_ORDER,
		type TaskPriority,
		type TaskStatus
	} from '$supabase/types';

	const id = $derived($page.params.id ?? '');
	const task = $derived(tasksStore.getTask(id));
	const today = $derived(todayStore.today);
	const subtasks = $derived(task ? tasksStore.subtasksForTask(task.id) : []);
	const progress = $derived(
		task ? tasksStore.progress(task.id) : { done: 0, total: 0, percent: 0 }
	);

	let editId = $state<string | null>(null);
	let title = $state('');
	let notes = $state('');
	let newSub = $state('');

	$effect(() => {
		const t = task;
		if (t && t.id !== editId) {
			editId = t.id;
			title = t.title;
			notes = t.notes;
		}
	});

	const statusOptions: DropdownOption[] = TASK_STATUS_ORDER.map((s) => ({
		value: s,
		label: STATUS_META[s].label,
		icon: STATUS_META[s].icon
	}));

	const priorityOptions: DropdownOption[] = TASK_PRIORITY_ORDER.map((p) => ({
		value: p,
		label: PRIORITY_META[p].label,
		dotClass: PRIORITY_META[p].dotClass
	}));

	const dl = $derived(task ? deadlineState(task.due_date, task.status, today) : 'none');

	function saveTitle() {
		if (!task) return;
		const next = title.trim();
		if (!next || next === task.title) {
			title = task.title;
			return;
		}
		void tasksStore.updateTask(task.id, { title: next });
	}

	function saveNotes() {
		if (!task || notes === task.notes) return;
		void tasksStore.updateTask(task.id, { notes });
	}

	function setDue(value: string) {
		if (!task) return;
		void tasksStore.updateTask(task.id, { due_date: value || null });
	}

	async function addSub(e: SubmitEvent) {
		e.preventDefault();
		if (!task) return;
		const t = newSub.trim();
		if (!t) return;
		newSub = '';
		await tasksStore.addSubtask(task.id, t);
	}

	async function removeTask() {
		if (!task) return;
		const ok = confirm('Удалить задачу?');
		if (!ok) return;
		await tasksStore.deleteTask(task.id);
		void goto(`${base}/tasks`);
	}
</script>

<div class="page-shell">
	<header class="flex items-center gap-2">
		<button
			type="button"
			onclick={() => goto(`${base}/tasks`)}
			class="tap-target -ml-1 grid place-items-center rounded-xl text-(--color-fg-mute) hover:bg-(--color-bg-mute) hover:text-(--color-fg)"
			aria-label="Назад к задачам"
		>
			<ChevronLeft size={22} />
		</button>
		<p class="page-kicker flex-1">Задача</p>
		{#if task}
			<button
				type="button"
				onclick={removeTask}
				class="tap-target grid place-items-center rounded-xl text-(--color-fg-mute) hover:bg-(--color-bg-mute) hover:text-rose-400"
				aria-label="Удалить задачу"
			>
				<Trash2 size={18} />
			</button>
		{/if}
	</header>

	{#if !task}
		<p class="py-16 text-center text-sm text-(--color-fg-mute)">
			{tasksStore.loaded ? 'Задача не найдена.' : 'Загрузка…'}
		</p>
	{:else}
		<input
			type="text"
			bind:value={title}
			onblur={saveTitle}
			onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			placeholder="Название задачи"
			maxlength="200"
			class="w-full rounded-xl bg-transparent text-xl font-semibold outline-none focus:bg-(--color-bg-mute) focus:px-3 focus:py-2"
		/>

		<div class="grid grid-cols-2 gap-2">
			<label class="flex flex-col gap-1">
				<span class="text-[11px] font-medium uppercase tracking-wide text-(--color-fg-mute)"
					>Статус</span
				>
				<Dropdown
					options={statusOptions}
					value={task.status}
					onChange={(v) => tasksStore.setStatus(task.id, v as TaskStatus)}
					ariaLabel="Статус задачи"
					block
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="text-[11px] font-medium uppercase tracking-wide text-(--color-fg-mute)"
					>Приоритет</span
				>
				<Dropdown
					options={priorityOptions}
					value={task.priority}
					onChange={(v) => tasksStore.updateTask(task.id, { priority: v as TaskPriority })}
					ariaLabel="Приоритет задачи"
					block
				/>
			</label>
		</div>

		<label class="flex flex-col gap-1">
			<span class="text-[11px] font-medium uppercase tracking-wide text-(--color-fg-mute)"
				>Дедлайн</span
			>
			<div class="flex items-center gap-2">
				<input
					type="date"
					value={task.due_date ?? ''}
					onchange={(e) => setDue(e.currentTarget.value)}
					class="hairline min-w-0 flex-1 rounded-xl bg-(--color-bg-mute) px-3 py-2.5 text-sm outline-none"
				/>
				{#if dl !== 'none' && task.due_date}
					<span
						class="inline-flex shrink-0 items-center gap-1 text-sm font-medium {dl === 'overdue'
							? 'text-rose-500'
							: 'text-rose-400'}"
						title={dl === 'overdue' ? 'Просрочено' : 'Скоро дедлайн'}
					>
						<AlarmClock size={15} />
						{deadlineLabel(task.due_date, today)}
					</span>
				{/if}
			</div>
		</label>

		<label class="flex flex-col gap-1">
			<span class="text-[11px] font-medium uppercase tracking-wide text-(--color-fg-mute)"
				>Заметка</span
			>
			<textarea
				bind:value={notes}
				onblur={saveNotes}
				rows="3"
				placeholder="Описание, детали…"
				class="hairline w-full resize-y rounded-xl bg-(--color-bg-mute) px-3 py-2.5 text-sm outline-none"
			></textarea>
		</label>

		<section class="flex flex-col gap-2">
			<div class="flex items-center justify-between">
				<h2 class="text-[11px] font-medium uppercase tracking-wide text-(--color-fg-mute)">
					Подзадачи
				</h2>
				{#if progress.total > 0}
					<span class="text-xs font-medium text-(--color-fg-mute)">
						{progress.done}/{progress.total} · {progress.percent}%
					</span>
				{/if}
			</div>

			{#if progress.total > 0}
				<span class="h-1.5 w-full overflow-hidden rounded-full bg-(--color-bg-mute)">
					<span
						class="block h-full rounded-full bg-(--color-accent) transition-all"
						style={`width: ${progress.percent}%`}
					></span>
				</span>
			{/if}

			<ul class="flex flex-col">
				{#each subtasks as sub (sub.id)}
					<li class="group flex items-center gap-3 py-1.5">
						<input
							type="checkbox"
							checked={sub.done}
							onchange={() => tasksStore.toggleSubtask(sub.id)}
							class="size-5 shrink-0 accent-(--color-accent)"
							aria-label={sub.title}
						/>
						<span
							class="min-w-0 flex-1 text-sm {sub.done ? 'text-(--color-fg-mute) line-through' : ''}"
						>
							{sub.title}
						</span>
						<button
							type="button"
							onclick={() => tasksStore.deleteSubtask(sub.id)}
							class="grid size-8 shrink-0 place-items-center rounded-lg text-(--color-fg-mute) hover:bg-(--color-bg-mute) hover:text-rose-400"
							aria-label="Удалить подзадачу"
						>
							<Trash2 size={14} />
						</button>
					</li>
				{/each}
			</ul>

			<form onsubmit={addSub} class="flex items-center gap-2">
				<input
					type="text"
					bind:value={newSub}
					placeholder="Новая подзадача…"
					maxlength="200"
					class="hairline min-w-0 flex-1 rounded-xl bg-(--color-bg-mute) px-3 py-2 text-sm outline-none"
				/>
				<button
					type="submit"
					class="tap-target grid place-items-center rounded-xl bg-(--color-accent) px-3 text-white disabled:opacity-40"
					disabled={!newSub.trim()}
					aria-label="Добавить подзадачу"
				>
					<Plus size={18} />
				</button>
			</form>
		</section>
	{/if}
</div>
