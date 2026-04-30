type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
	id: number;
	kind: ToastKind;
	message: string;
}

class ToastStore {
	items = $state<Toast[]>([]);
	#nextId = 1;

	push(message: string, kind: ToastKind = 'info', durationMs = 3500): void {
		const id = this.#nextId++;
		this.items = [...this.items, { id, kind, message }];
		if (durationMs > 0 && typeof window !== 'undefined') {
			window.setTimeout(() => this.dismiss(id), durationMs);
		}
	}

	success(message: string): void {
		this.push(message, 'success');
	}

	error(message: string): void {
		this.push(message, 'error', 5000);
	}

	dismiss(id: number): void {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

export const toasts = new ToastStore();
