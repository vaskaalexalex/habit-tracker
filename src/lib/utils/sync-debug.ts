const STORAGE_KEY = 'habit-sync-debug-log';
const MAX_ENTRIES = 250;

export interface SyncDebugEntry {
	ts: string;
	event: string;
	data?: Record<string, unknown>;
}

function readEntries(): SyncDebugEntry[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? (parsed as SyncDebugEntry[]) : [];
	} catch {
		return [];
	}
}

function normalizeValue(value: unknown): unknown {
	if (value instanceof Error) return { name: value.name, message: value.message };
	if (value && typeof value === 'object') {
		const objectValue = value as Record<string, unknown>;
		return {
			message: objectValue.message,
			code: objectValue.code,
			details: objectValue.details,
			hint: objectValue.hint,
			status: objectValue.status
		};
	}
	if (typeof value === 'string' && value.length > 180) return `${value.slice(0, 180)}...`;
	return value;
}

export function syncDebug(event: string, data?: Record<string, unknown>): void {
	if (typeof window === 'undefined') return;

	const entry: SyncDebugEntry = {
		ts: new Date().toISOString(),
		event,
		data: data
			? Object.fromEntries(Object.entries(data).map(([key, value]) => [key, normalizeValue(value)]))
			: undefined
	};

	try {
		const entries = [...readEntries(), entry].slice(-MAX_ENTRIES);
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	} catch {
		// Ignore storage quota/private mode failures; console still helps attached debuggers.
	}

	console.info('[sync-debug]', entry.event, entry.data ?? {});
}

export function getSyncDebugLogText(): string {
	return readEntries()
		.map((entry) => {
			const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
			return `${entry.ts} ${entry.event}${data}`;
		})
		.join('\n');
}

export function clearSyncDebugLog(): void {
	if (typeof window === 'undefined') return;
	window.localStorage.removeItem(STORAGE_KEY);
	syncDebug('debug-log-cleared');
}
