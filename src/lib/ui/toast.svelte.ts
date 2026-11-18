export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
	id: number;
	message: string;
	kind: ToastKind;
}

class ToastStore {
	items = $state<ToastItem[]>([]);
	#nextId = 1;
	#timers = new Map<number, ReturnType<typeof setTimeout>>();

	/** Toont een melding die na `durationMs` vanzelf verdwijnt (0 = blijft staan). Geeft het id terug. */
	show(message: string, kind: ToastKind = 'info', durationMs = 4000): number {
		const id = this.#nextId++;
		this.items = [...this.items.slice(-2), { id, message, kind }];
		if (durationMs > 0) this.#timers.set(id, setTimeout(() => this.dismiss(id), durationMs));
		return id;
	}

	dismiss(id: number): void {
		const timer = this.#timers.get(id);
		if (timer) clearTimeout(timer);
		this.#timers.delete(id);
		this.items = this.items.filter((toast) => toast.id !== id);
	}

	clear(): void {
		for (const id of [...this.#timers.keys()]) this.dismiss(id);
		this.items = [];
	}
}

export const toasts = new ToastStore();