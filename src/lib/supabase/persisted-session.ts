import type { Session, User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AUTH_STORAGE_KEY } from '$supabase/client';
import { syncDebug } from '$utils/sync-debug';

/** Saved whenever we have a real session so offline UX can fall back to Dexie-scoped mode */
export const LAST_USER_STORAGE_KEY = 'habits-last-user-id';

const JWT_SKEW_SECONDS = 120;

interface JwtPayload {
	sub?: string;
	exp?: number;
	email?: string;
}

function decodeJwtPayload(accessToken: string): JwtPayload | null {
	try {
		const parts = accessToken.split('.');
		const payload = parts[1];
		if (payload === undefined) return null;
		let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
		while (base64.length % 4 !== 0) base64 += '=';
		const json = atob(base64);
		return JSON.parse(json) as JwtPayload;
	} catch {
		return null;
	}
}

/** True if access JWT still usable (not expired beyond skew). */
export function isAccessTokenValid(accessToken: string): boolean {
	const p = decodeJwtPayload(accessToken);
	if (p?.exp === undefined) return false;
	return p.exp * 1000 > Date.now() + JWT_SKEW_SECONDS * 1000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** GoTrue persists `{ currentSession: Session | null, ... }`; tolerate flat session-shaped JSON */
function extractSessionFromParsed(parsed: unknown): Session | null {
	if (!isRecord(parsed)) return null;
	const nested = parsed.currentSession ?? parsed.session;
	if (nested !== undefined && nested !== null && isRecord(nested) && typeof nested.access_token === 'string') {
		return nested as unknown as Session;
	}
	if (typeof parsed.access_token === 'string' && typeof parsed.refresh_token === 'string') {
		return parsed as unknown as Session;
	}
	return null;
}

export function readPersistedSessionFromStorage(): Session | null {
	if (typeof window === 'undefined') return null;
	const raw = localStorage.getItem(AUTH_STORAGE_KEY);
	if (!raw) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		return extractSessionFromParsed(parsed);
	} catch {
		return null;
	}
}

export function persistLastUserId(userId: string | null): void {
	if (typeof window === 'undefined') return;
	if (userId) localStorage.setItem(LAST_USER_STORAGE_KEY, userId);
	else localStorage.removeItem(LAST_USER_STORAGE_KEY);
}

export function readLastUserId(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem(LAST_USER_STORAGE_KEY);
}

/** Offline-only stub when tokens expired but local Dexie data still keyed by this user */
export function minimalUserFromId(id: string): User {
	return {
		id,
		aud: 'authenticated',
		role: 'authenticated',
		app_metadata: {},
		user_metadata: {},
		created_at: '',
		updated_at: ''
	} as User;
}

/**
 * Restore Supabase session from localStorage without relying on getSession() timeout.
 * Uses setSession so the client attaches JWT for postbox RPC when back online.
 */
export async function recoverOfflineSession(client: SupabaseClient): Promise<{
	session: Session | null;
	user: User | null;
	source: 'setSession' | 'persisted' | 'none';
}> {
	const persisted = readPersistedSessionFromStorage();
	if (!persisted?.access_token || !persisted.refresh_token) {
		return { session: null, user: null, source: 'none' };
	}

	if (!isAccessTokenValid(persisted.access_token)) {
		return { session: null, user: null, source: 'none' };
	}

	try {
		const { data, error } = await client.auth.setSession({
			access_token: persisted.access_token,
			refresh_token: persisted.refresh_token
		});
		if (!error && data.session?.user) {
			return { session: data.session, user: data.session.user, source: 'setSession' };
		}
		if (error) {
			syncDebug('auth-offline-set-session-error', { message: error.message });
		}
	} catch (err) {
		syncDebug('auth-offline-set-session-throw', {
			error: err instanceof Error ? err.message : String(err)
		});
	}

	if (persisted.user && isAccessTokenValid(persisted.access_token)) {
		return { session: persisted, user: persisted.user, source: 'persisted' };
	}

	const sub = decodeJwtPayload(persisted.access_token)?.sub;
	if (sub) {
		const user = minimalUserFromId(sub);
		return { session: persisted, user, source: 'persisted' };
	}

	return { session: null, user: null, source: 'none' };
}
