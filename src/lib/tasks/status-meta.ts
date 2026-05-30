import { Circle, Timer, CheckCircle2 } from 'lucide-svelte';
import type { ComponentType } from 'svelte';
import {
	TASK_PRIORITY_LABELS,
	TASK_STATUS_LABELS,
	type TaskPriority,
	type TaskStatus
} from '$supabase/types';

/** lucide-svelte icons are legacy class components, hence `ComponentType`. */
type IconComponent = ComponentType;

export interface StatusMeta {
	label: string;
	icon: IconComponent;
	/** Text colour for icon + chip. */
	colorClass: string;
	/** Soft background for chip. */
	chipClass: string;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
	todo: {
		label: TASK_STATUS_LABELS.todo,
		icon: Circle,
		colorClass: 'text-(--color-fg-mute)',
		chipClass: 'bg-(--color-bg-mute) text-(--color-fg-mute)'
	},
	in_progress: {
		label: TASK_STATUS_LABELS.in_progress,
		icon: Timer,
		colorClass: 'text-amber-500',
		chipClass: 'bg-amber-500/15 text-amber-500'
	},
	done: {
		label: TASK_STATUS_LABELS.done,
		icon: CheckCircle2,
		colorClass: 'text-emerald-500',
		chipClass: 'bg-emerald-500/15 text-emerald-500'
	}
};

export interface PriorityMeta {
	label: string;
	/** Colour dot background. */
	dotClass: string;
}

export const PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
	low: { label: TASK_PRIORITY_LABELS.low, dotClass: 'bg-slate-400' },
	medium: { label: TASK_PRIORITY_LABELS.medium, dotClass: 'bg-amber-400' },
	high: { label: TASK_PRIORITY_LABELS.high, dotClass: 'bg-rose-500' }
};
