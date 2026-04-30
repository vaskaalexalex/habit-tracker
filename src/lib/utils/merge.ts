export function mergeByKey<T>(
	local: readonly T[],
	remote: readonly T[],
	getKey: (item: T) => string,
	resolveConflict: (localItem: T, remoteItem: T) => T = (_localItem, remoteItem) => remoteItem
): T[] {
	const merged = new Map<string, T>();

	for (const item of remote) {
		merged.set(getKey(item), item);
	}

	for (const item of local) {
		const key = getKey(item);
		const remoteItem = merged.get(key);
		merged.set(key, remoteItem ? resolveConflict(item, remoteItem) : item);
	}

	return Array.from(merged.values());
}
