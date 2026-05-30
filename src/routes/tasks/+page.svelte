<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { Plus, AlarmClock, X, Check, ChevronDown } from 'lucide-svelte';
	import { tasksStore } from '$stores/tasks.svelte';
	import { todayStore } from '$stores/today.svelte';
	import PageHeader from '$components/PageHeader.svelte';
	import { STATUS_META, PRIORITY_META } from '$lib/tasks/status-meta';
	import { deadlineState, deadlineLabel } from '$lib/tasks/deadline';
	import { TASK_STATUS_ORDER, type Task, type TaskStatus } from '$supabase/types';

	const today = $derived(todayStore.today);

	let selectedList = $state<'all' | string>('all');
	let statusFilter = $state<'all' | TaskStatus>('all');
	let newTitle = $state('');
	let addingList = $state(false);
	let newListName = $state('');

	function priorityRank(t: Task): number {
		return t.priority === 'high' ? 0 : t.priority === 'medium' ? 1 : 2;
	}

	const visibleTasks = $derived.by(() => {
		const pool = selectedList === 'all' ? tasksStore.tasks : tasksStore.tasksForList(selectedList);
		const filtered = pool.filter((t) => statusFilter === 'all' || t.status === statusFilter);
		return filtered.slice().sort((a, b) => {
			const aDone = a.status === 'done' ? 1 : 0;
			const bDone = b.status === 'done' ? 1 : 0;
			if (aDone !== bDone) return aDone - bDone;
			const aDue = a.due_date ?? '9999-99-99';
			const bDue = b.due_date ?? '9999-99-99';
			if (aDue !== bDue) return aDue < bDue ? -1 : 1;
			if (priorityRank(a) !== priorityRank(b)) return priorityRank(a) - priorityRank(b);
			return b.created_at.localeCompare(a.created_at);
		});
	});

	const activeCount = $derived(tasksStore.tasks.filter((t) => t.status !== 'done').length);

	async function addTask(e: SubmitEvent) {
		e.preventDefault();
		const title = newTitle.trim();
		if (!title) return;
		newTitle = '';
		await tasksStore.createTask({
			title,
			list_id: selectedList === 'all' ? null : selectedList
		});
	}

	async function saveNewList(e: SubmitEvent) {
		e.preventDefault();
		const created = await tasksStore.createList(newListName);
		newListName = '';
		addingList = false;
		if (created) selectedList = created.id;
	}

	function openTask(id: string) {
		void goto(`${base}/tasks/${id}`);
	}
</script>

<div class="page-shell">
	<PageHeader kicker="Трекер" title="Задачи" subtitle={`${activeCount} активных`} />

	<div class="flex items-center gap-2">
		<div class="relative min-w-0 flex-1">
			<select
				value={selectedList}
				onchange={(e) => (selectedList = e.currentTarget.value)}
				aria-label="Список задач"
				class="native-select"
			>
				<option value="all">Все задачи</option>
				{#each tasksStore.lists as l (l.id)}
					<option value={l.id}>{l.name}</option>
				{/each}
			</select>
			<ChevronDown size={16} class="select-chevron" aria-hidden="true" />
		</div>
		<div class="relative min-w-0 flex-1">
			<select
				value={statusFilter}
				onchange={(e) => (statusFilter = e.currentTarget.value as 'all' | TaskStatus)}
				aria-label="Фильтр по статусу"
				class="native-select"
			>
				<option value="all">Все статусы</option>
				{#each TASK_STATUS_ORDER as s (s)}
					<option value={s}>{STATUS_META[s].label}</option>
				{/each}
			</select>
			<ChevronDown size={16} class="select-chevron" aria-hidden="true" />
		</div>
		<button
			type="button"
			onclick={() => (addingList = !addingList)}
			class="tap-target hairline grid shrink-0 place-items-center rounded-xl bg-(--color-bg-mute) px-2.5 text-(--color-fg-mute) hover:text-(--color-fg)"
			aria-label="Новый список"
		>
			<Plus size={18} />
		</button>
	</div>

	{#if addingList}
		<form onsubmit={saveNewList} class="flex items-center gap-2">
			<input
				type="text"
				bind:value={newListName}
				placeholder="Название списка"
				maxlength="60"
				class="hairline min-w-0 flex-1 rounded-xl bg-(--color-bg-mute) px-3 py-2 text-sm outline-none"
			/>
			<button
				type="submit"
				class="tap-target grid place-items-center rounded-xl bg-(--color-accent) px-3 text-white disabled:opacity-40"
				disabled={!newListName.trim()}
				aria-label="Сохранить список"
			>
				<Check size={18} />
			</button>
			<button
				type="button"
				onclick={() => {
					addingList = false;
					newListName = '';
				}}
				class="tap-target grid place-items-center rounded-xl text-(--color-fg-mute) hover:bg-(--color-bg-mute)"
				aria-label="Отмена"
			>
				<X size={18} />
			</button>
		</form>
	{/if}

	<form onsubmit={addTask} class="flex items-center gap-2">
		<input
			type="text"
			bind:value={newTitle}
			placeholder="Новая задача…"
			maxlength="200"
			class="hairline min-w-0 flex-1 rounded-xl bg-(--color-bg-mute) px-3 py-2.5 text-sm outline-none"
		/>
		<button
			type="submit"
			class="tap-target inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-(--color-accent) px-3.5 text-sm font-semibold text-white disabled:opacity-40"
			disabled={!newTitle.trim()}
		>
			<Plus size={16} />
			Добавить
		</button>
	</form>

	<ul class="flex flex-col gap-2">
		{#each visibleTasks as task (task.id)}
			{@const meta = STATUS_META[task.status]}
			{@const StatusIcon = meta.icon}
			{@const progress = tasksStore.progress(task.id)}
			{@const dl = deadlineState(task.due_date, task.status, today)}
			<li class="relative">
				<button
					type="button"
					onclick={() => openTask(task.id)}
					aria-label={`Открыть задачу: ${task.title}`}
					class="hairline absolute inset-0 w-full rounded-2xl bg-(--color-bg-soft) transition active:scale-[0.99]"
				></button>

				<div class="pointer-events-none relative flex select-none items-start gap-3 p-3">
					<span
						class="mt-0.5 size-2.5 shrink-0 rounded-full {PRIORITY_META[task.priority].dotClass}"
						title={`Приоритет: ${PRIORITY_META[task.priority].label}`}
					></span>

					<span class="flex min-w-0 flex-1 flex-col gap-1.5">
						<span
							class="truncate text-sm font-medium {task.status === 'done'
								? 'text-(--color-fg-mute) line-through'
								: ''}"
						>
							{task.title}
						</span>

						<span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
							<span class="pointer-events-auto relative inline-flex items-center">
								<StatusIcon
									size={12}
									class="pointer-events-none absolute left-2 {meta.colorClass}"
								/>
								<select
									value={task.status}
									onchange={(e) =>
										tasksStore.setStatus(task.id, e.currentTarget.value as TaskStatus)}
									aria-label="Статус задачи"
									class="cursor-pointer appearance-none rounded-full py-0.5 pl-7 pr-6 font-medium outline-none {meta.chipClass}"
								>
									{#each TASK_STATUS_ORDER as s (s)}
										<option value={s}>{STATUS_META[s].label}</option>
									{/each}
								</select>
								<ChevronDown
									size={12}
									class="pointer-events-none absolute right-1.5 {meta.colorClass}"
								/>
							</span>

							{#if progress.total > 0}
								<span class="text-(--color-fg-mute)">{progress.percent}%</span>
							{/if}

							{#if dl !== 'none' && task.due_date}
								<span
									class="inline-flex items-center gap-1 font-medium {dl === 'overdue'
										? 'text-rose-500'
										: 'text-rose-400'}"
									title={dl === 'overdue' ? 'Просрочено' : 'Скоро дедлайн'}
								>
									<AlarmClock size={13} />
									{deadlineLabel(task.due_date, today)}
								</span>
							{/if}
						</span>

						{#if progress.total > 0}
							<span class="h-1.5 w-full overflow-hidden rounded-full bg-(--color-bg-mute)">
								<span
									class="block h-full rounded-full bg-(--color-accent) transition-all"
									style={`width: ${progress.percent}%`}
								></span>
							</span>
						{/if}
					</span>
				</div>
			</li>
		{/each}
	</ul>

	{#if visibleTasks.length === 0}
		<p class="py-10 text-center text-sm text-(--color-fg-mute)">
			{tasksStore.tasks.length === 0
				? 'Пока нет задач. Добавь первую выше.'
				: 'Нет задач по выбранному фильтру.'}
		</p>
	{/if}
</div>
