import type { Session, User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '$db/dexie';
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
		const lastId = readLastUserId();
		const sub = decodeJwtPayload(persisted.access_token)?.sub;
		if (lastId && (!sub || sub === lastId)) {
			syncDebug('auth-recover-expired-jwt-last-user', { userId: lastId });
			return { session: null, user: minimalUserFromId(lastId), source: 'persisted' };
		}
		return { session: null, user: null, source: 'none' };
	}

	const online = typeof navigator === 'undefined' || navigator.onLine !== false;
	if (online) {
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
	} else {
		syncDebug('auth-recover-skip-set-session-offline');
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

/** True if IndexedDB still has rows for this user (offline app shell is meaningful). */
export async function hasLocalUserData(userId: string): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	try {
		const habit = await db.habit_completions.where('user_id').equals(userId).first();
		if (habit) return true;
		const journal = await db.journal_entries.where('user_id').equals(userId).first();
		if (journal) return true;
		const set = await db.workout_sets.where('user_id').equals(userId).first();
		return !!set;
	} catch {
		return false;
	}
}

export type CachedAuthSource = 'setSession' | 'persisted' | 'last-user-id' | 'none';

/**
 * Best-effort local auth for offline / flaky network: JWT in storage, then last user id + local cache.
 */
export async function resolveCachedAuthUser(client: SupabaseClient): Promise<{
	session: Session | null;
	user: User | null;
	source: CachedAuthSource;
}> {
	const recovered = await recoverOfflineSession(client);
	if (recovered.user) {
		return {
			session: recovered.session,
			user: recovered.user,
			source: recovered.source === 'none' ? 'none' : recovered.source
		};
	}

	const lastId = readLastUserId();
	if (!lastId) {
		return { session: null, user: null, source: 'none' };
	}

	if (await hasLocalUserData(lastId)) {
		syncDebug('auth-resolve-last-user-with-dexie', { userId: lastId });
		return { session: null, user: minimalUserFromId(lastId), source: 'last-user-id' };
	}

	const persisted = readPersistedSessionFromStorage();
	if (persisted?.access_token) {
		syncDebug('auth-resolve-last-user-with-persisted-token', { userId: lastId });
		return { session: null, user: minimalUserFromId(lastId), source: 'last-user-id' };
	}

	return { session: null, user: null, source: 'none' };
}

/** Ignore GoTrue INITIAL_SESSION=null when local session markers exist. */
export function shouldIgnoreInitialNullSession(): boolean {
	if (readLastUserId()) return true;
	const persisted = readPersistedSessionFromStorage();
	return !!(persisted?.access_token && persisted.refresh_token);
}
