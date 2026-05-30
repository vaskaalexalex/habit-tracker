import { db } from '$db/dexie';
import { drainQueue, enqueue } from '$db/sync';
import { isSupabaseConfigured } from '$supabase/client';
import { fetchSubtasks, fetchTaskLists, fetchTasks } from '$supabase/api';
import type { Subtask, Task, TaskList, TaskPriority, TaskStatus, UUID } from '$supabase/types';
import { uuid } from '$utils/uuid';
import { mergeByKey } from '$utils/merge';
import { syncDebug } from '$utils/sync-debug';

export interface TaskProgress {
	done: number;
	total: number;
	percent: number;
}

function asRow(value: unknown): Record<string, unknown> {
	return value as Record<string, unknown>;
}

class TasksStore {
	lists = $state<TaskList[]>([]);
	tasks = $state<Task[]>([]);
	subtasks = $state<Subtask[]>([]);
	loading = $state<boolean>(false);
	loaded = $state<boolean>(false);

	#userId: UUID | null = null;

	setUser(userId: UUID | null): void {
		if (this.#userId === userId) return;
		this.#userId = userId;
		this.lists = [];
		this.tasks = [];
		this.subtasks = [];
		this.loaded = false;
	}

	async hydrateLocal(): Promise<void> {
		if (!this.#userId) return;
		try {
			const [lists, tasks, subtasks] = await Promise.all([
				db.task_lists.where('user_id').equals(this.#userId).toArray(),
				db.tasks.where('user_id').equals(this.#userId).toArray(),
				db.task_subtasks.where('user_id').equals(this.#userId).toArray()
			]);
			this.lists = lists;
			this.tasks = tasks;
			this.subtasks = subtasks;
			this.loaded = true;
			syncDebug('tasks-local-loaded', {
				lists: lists.length,
				tasks: tasks.length,
				subtasks: subtasks.length
			});
		} catch (err) {
			syncDebug('tasks-local-error', {
				error: err instanceof Error ? err.message : String(err)
			});
			console.error('[tasks.hydrateLocal]', err);
			this.lists = [];
			this.tasks = [];
			this.subtasks = [];
			this.loaded = true;
		}
	}

	async syncRemote(): Promise<void> {
		if (!this.#userId) return;
		const online = typeof navigator === 'undefined' || navigator.onLine !== false;
		if (!isSupabaseConfigured || !online) {
			syncDebug('tasks-remote-skip', { configured: isSupabaseConfigured, online });
			return;
		}

		const beforeListIds = new Set(this.lists.map((l) => l.id));
		const beforeTaskIds = new Set(this.tasks.map((t) => t.id));
		const beforeSubIds = new Set(this.subtasks.map((s) => s.id));

		try {
			await drainQueue();
			const [lists, tasks, subtasks] = await Promise.all([
				fetchTaskLists(this.#userId),
				fetchTasks(this.#userId),
				fetchSubtasks(this.#userId)
			]);
			syncDebug('tasks-remote-loaded', {
				lists: lists.length,
				tasks: tasks.length,
				subtasks: subtasks.length
			});
			await Promise.all([
				db.task_lists.bulkPut(lists),
				db.tasks.bulkPut(tasks),
				db.task_subtasks.bulkPut(subtasks)
			]);

			this.lists = mergeByKey(
				this.lists,
				this.#dropDeleted(lists, beforeListIds, this.lists),
				(l) => l.id
			);
			this.tasks = mergeByKey(
				this.tasks,
				this.#dropDeleted(tasks, beforeTaskIds, this.tasks),
				(t) => t.id,
				// Prefer the row with the newer updated_at on conflict.
				(local, remote) => (local.updated_at > remote.updated_at ? local : remote)
			);
			this.subtasks = mergeByKey(
				this.subtasks,
				this.#dropDeleted(subtasks, beforeSubIds, this.subtasks),
				(s) => s.id
			);
		} catch (err) {
			syncDebug('tasks-remote-error', {
				error: err instanceof Error ? err.message : String(err)
			});
			console.error('[tasks.syncRemote]', err);
		}
	}

	/** Remove remote rows the user deleted locally during this sync window. */
	#dropDeleted<T extends { id: UUID }>(remote: T[], beforeIds: Set<UUID>, current: T[]): T[] {
		const currentIds = new Set(current.map((r) => r.id));
		const removed = new Set<UUID>();
		for (const id of beforeIds) if (!currentIds.has(id)) removed.add(id);
		return removed.size === 0 ? remote : remote.filter((r) => !removed.has(r.id));
	}

	async refresh(): Promise<void> {
		if (!this.#userId) return;
		this.loading = true;
		syncDebug('tasks-refresh-start', { userId: this.#userId });
		await this.hydrateLocal();
		await this.syncRemote();
		this.loading = false;
		syncDebug('tasks-refresh-finish', { tasks: this.tasks.length });
	}

	getTask(id: UUID): Task | null {
		return this.tasks.find((t) => t.id === id) ?? null;
	}

	subtasksForTask(taskId: UUID): Subtask[] {
		return this.subtasks
			.filter((s) => s.task_id === taskId)
			.slice()
			.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
	}

	progress(taskId: UUID): TaskProgress {
		const subs = this.subtasks.filter((s) => s.task_id === taskId);
		const total = subs.length;
		const done = subs.filter((s) => s.done).length;
		const percent = total === 0 ? 0 : Math.round((done / total) * 100);
		return { done, total, percent };
	}

	tasksForList(listId: UUID | null): Task[] {
		return listId === null ? this.tasks : this.tasks.filter((t) => t.list_id === listId);
	}

	#nextListOrder(): number {
		return this.lists.reduce((m, l) => Math.max(m, l.sort_order), 0) + 1;
	}

	#nextTaskOrder(): number {
		return this.tasks.reduce((m, t) => Math.max(m, t.sort_order), 0) + 1;
	}

	#nextSubtaskOrder(taskId: UUID): number {
		return this.subtasksForTask(taskId).reduce((m, s) => Math.max(m, s.sort_order), 0) + 1;
	}

	async createList(name: string): Promise<TaskList | null> {
		if (!this.#userId) return null;
		const trimmed = name.trim();
		if (!trimmed) return null;
		const row: TaskList = {
			id: uuid(),
			user_id: this.#userId,
			name: trimmed.slice(0, 60),
			sort_order: this.#nextListOrder(),
			created_at: new Date().toISOString()
		};
		this.lists = [...this.lists, row];
		await db.task_lists.put(row);
		await enqueue('task_lists', 'upsert', asRow(row));
		void drainQueue();
		return row;
	}

	async deleteList(id: UUID): Promise<void> {
		this.lists = this.lists.filter((l) => l.id !== id);
		// Detach tasks locally (matches FK on delete set null).
		const affected = this.tasks.filter((t) => t.list_id === id);
		for (const t of affected) await this.updateTask(t.id, { list_id: null });
		await db.task_lists.delete(id);
		await enqueue('task_lists', 'delete', { id });
		void drainQueue();
	}

	async createTask(input: {
		title: string;
		list_id?: UUID | null;
		status?: TaskStatus;
		priority?: TaskPriority;
		due_date?: string | null;
		notes?: string;
	}): Promise<Task | null> {
		if (!this.#userId) return null;
		const title = input.title.trim();
		if (!title) return null;
		const now = new Date().toISOString();
		const row: Task = {
			id: uuid(),
			user_id: this.#userId,
			list_id: input.list_id ?? null,
			title: title.slice(0, 200),
			notes: input.notes ?? '',
			status: input.status ?? 'in_progress',
			priority: input.priority ?? 'medium',
			due_date: input.due_date ?? null,
			sort_order: this.#nextTaskOrder(),
			created_at: now,
			updated_at: now
		};
		this.tasks = [...this.tasks, row];
		await db.tasks.put(row);
		await enqueue('tasks', 'upsert', asRow(row));
		void drainQueue();
		return row;
	}

	async updateTask(
		id: UUID,
		patch: Partial<Pick<Task, 'title' | 'notes' | 'status' | 'priority' | 'due_date' | 'list_id'>>
	): Promise<void> {
		const existing = this.tasks.find((t) => t.id === id);
		if (!existing) return;
		const updated: Task = { ...existing, ...patch, updated_at: new Date().toISOString() };
		this.tasks = this.tasks.map((t) => (t.id === id ? updated : t));
		await db.tasks.put(updated);
		await enqueue('tasks', 'upsert', asRow(updated));
		void drainQueue();
	}

	async setStatus(id: UUID, status: TaskStatus): Promise<void> {
		await this.updateTask(id, { status });
	}

	async deleteTask(id: UUID): Promise<void> {
		this.tasks = this.tasks.filter((t) => t.id !== id);
		const subs = this.subtasks.filter((s) => s.task_id === id);
		this.subtasks = this.subtasks.filter((s) => s.task_id !== id);
		// Remote delete cascades subtasks; clean local mirror only.
		if (subs.length > 0) await db.task_subtasks.bulkDelete(subs.map((s) => s.id));
		await db.tasks.delete(id);
		await enqueue('tasks', 'delete', { id });
		void drainQueue();
	}

	async addSubtask(taskId: UUID, title: string): Promise<Subtask | null> {
		if (!this.#userId) return null;
		const trimmed = title.trim();
		if (!trimmed) return null;
		const row: Subtask = {
			id: uuid(),
			user_id: this.#userId,
			task_id: taskId,
			title: trimmed.slice(0, 200),
			done: false,
			sort_order: this.#nextSubtaskOrder(taskId),
			created_at: new Date().toISOString()
		};
		this.subtasks = [...this.subtasks, row];
		await db.task_subtasks.put(row);
		await enqueue('task_subtasks', 'upsert', asRow(row));
		void drainQueue();
		return row;
	}

	async toggleSubtask(id: UUID): Promise<void> {
		const existing = this.subtasks.find((s) => s.id === id);
		if (!existing) return;
		const updated: Subtask = { ...existing, done: !existing.done };
		this.subtasks = this.subtasks.map((s) => (s.id === id ? updated : s));
		await db.task_subtasks.put(updated);
		await enqueue('task_subtasks', 'upsert', asRow(updated));
		void drainQueue();
	}

	async renameSubtask(id: UUID, title: string): Promise<void> {
		const existing = this.subtasks.find((s) => s.id === id);
		if (!existing) return;
		const trimmed = title.trim();
		if (!trimmed) return;
		const updated: Subtask = { ...existing, title: trimmed.slice(0, 200) };
		this.subtasks = this.subtasks.map((s) => (s.id === id ? updated : s));
		await db.task_subtasks.put(updated);
		await enqueue('task_subtasks', 'upsert', asRow(updated));
		void drainQueue();
	}

	async deleteSubtask(id: UUID): Promise<void> {
		this.subtasks = this.subtasks.filter((s) => s.id !== id);
		await db.task_subtasks.delete(id);
		await enqueue('task_subtasks', 'delete', { id });
		void drainQueue();
	}
}

export const tasksStore = new TasksStore();
