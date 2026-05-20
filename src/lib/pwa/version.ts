import { base } from '$app/paths';

export type BuildMeta = {
	id: string;
	builtAt: string;
};

/** Build baked into this JS bundle (matches static/build-id.json at build time). */
export const localBuildId = import.meta.env.PUBLIC_APP_BUILD_ID ?? 'dev';

export function shortBuildId(id: string): string {
	return id.length > 7 ? id.slice(0, 7) : id;
}

export async function fetchDeployedBuildMeta(): Promise<BuildMeta | null> {
	if (typeof fetch === 'undefined') return null;
	const path = `${base}/build-id.json`.replace(/\/{2,}/g, '/');
	const url = `${path}?t=${Date.now()}`;
	try {
		const res = await fetch(url, { cache: 'no-store' });
		if (!res.ok) return null;
		const data: unknown = await res.json();
		if (
			typeof data === 'object' &&
			data !== null &&
			'id' in data &&
			typeof (data as BuildMeta).id === 'string'
		) {
			const meta = data as BuildMeta;
			return {
				id: meta.id,
				builtAt: typeof meta.builtAt === 'string' ? meta.builtAt : ''
			};
		}
		return null;
	} catch {
		return null;
	}
}

export function isNewerBuildAvailable(localId: string, remote: BuildMeta | null): boolean {
	if (!remote?.id) return false;
	return remote.id !== localId;
}
