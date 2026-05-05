import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '$supabase/client';
import {
	isAccessTokenValid,
	minimalUserFromId,
	persistLastUserId,
	readLastUserId,
	readPersistedSessionFromStorage,
	recoverOfflineSession
} from '$supabase/persisted-session';
import { syncDebug } from '$utils/sync-debug';

const SESSION_TIMEOUT_MS = 3_000;

export interface AuthState {
	user: User | null;
	session: Session | null;
	loading: boolean;
	initialized: boolean;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err) => {
				clearTimeout(timer);
				reject(err);
			}
		);
	});
}

class AuthStore {
	user = $state<User | null>(null);
	session = $state<Session | null>(null);
	loading = $state<boolean>(true);
	initialized = $state<boolean>(false);

	#unsubscribe: (() => void) | null = null;
	#stopSessionWatchers: (() => void) | null = null;

	async init(): Promise<void> {
		if (this.initialized) return;
		if (!isSupabaseConfigured) {
			syncDebug('auth-init-unconfigured');
			this.initialized = true;
			this.loading = false;
			return;
		}

		this.loading = true;
		const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

		// Restore session before onAuthStateChange so INITIAL_SESSION does not run a doomed refresh offline.
		if (offline) {
			syncDebug('auth-init-offline');
			const recovered = await recoverOfflineSession(supabase);
			if (recovered.user) {
				this.session = recovered.session;
				this.user = recovered.user;
				syncDebug('auth-offline-recovered', {
					source: recovered.source,
					userId: this.user?.id
				});
			} else {
				const lastId = readLastUserId();
				if (lastId) {
					this.user = minimalUserFromId(lastId);
					this.session = null;
					syncDebug('auth-offline-last-user-fallback', { userId: lastId });
				}
			}
		} else {
			try {
				const { data } = await withTimeout(
					supabase.auth.getSession(),
					SESSION_TIMEOUT_MS,
					'auth.getSession'
				);
				this.session = data.session;
				this.user = data.session?.user ?? null;
				syncDebug('auth-session-loaded', { hasSession: !!this.session, userId: this.user?.id });
			} catch (err) {
				syncDebug('auth-session-timeout', {
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}

		try {
			const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
				const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
				// GoTrue emits INITIAL_SESSION with null after failed refresh/setSession offline — do not wipe recovered store state.
				if (!session && event === 'INITIAL_SESSION' && offline) {
					if (this.user) {
						syncDebug('auth-state-change-ignore-initial-null-offline', {
							keptUserId: this.user.id
						});
						return;
					}
					const persisted = readPersistedSessionFromStorage();
					if (persisted?.access_token && isAccessTokenValid(persisted.access_token)) {
						syncDebug('auth-state-change-ignore-initial-null-offline-valid-storage');
						return;
					}
					if (readLastUserId()) {
						syncDebug('auth-state-change-ignore-initial-null-offline-last-user-key');
						return;
					}
				}

				this.session = session;
				this.user = session?.user ?? null;
				if (session?.user?.id) persistLastUserId(session.user.id);
				syncDebug('auth-state-change', {
					event,
					hasSession: !!session,
					userId: this.user?.id
				});
			});
			this.#unsubscribe = () => sub.subscription.unsubscribe();
		} catch (err) {
			syncDebug('auth-onchange-error', {
				error: err instanceof Error ? err.message : String(err)
			});
		}

		if (this.user?.id) persistLastUserId(this.user.id);

		this.#startSessionWatchers();
		this.initialized = true;
		this.loading = false;
	}

	async signInWithEmail(email: string, redirectTo?: string): Promise<{ error?: string }> {
		if (!isSupabaseConfigured) {
			return { error: 'Supabase не настроен. Заполни PUBLIC_SUPABASE_* в .env' };
		}
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: redirectTo ? { emailRedirectTo: redirectTo } : undefined
		});
		if (error) return { error: localizeAuthError(error.message, error.status) };
		return {};
	}

	async signInWithPassword(email: string, password: string): Promise<{ error?: string }> {
		if (!isSupabaseConfigured) {
			return { error: 'Supabase не настроен. Заполни PUBLIC_SUPABASE_* в .env' };
		}
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) return { error: localizeAuthError(error.message, error.status) };
		return {};
	}

	async signOut(): Promise<void> {
		await supabase.auth.signOut();
		persistLastUserId(null);
		this.user = null;
		this.session = null;
	}

	dispose(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = null;
		this.#stopSessionWatchers?.();
		this.#stopSessionWatchers = null;
	}

	#startSessionWatchers(): void {
		if (typeof window === 'undefined' || this.#stopSessionWatchers) return;

		const syncSession = async (reason: string) => {
			if (typeof navigator !== 'undefined' && navigator.onLine === false) {
				syncDebug('auth-session-sync-skip-offline', { reason });
				return;
			}
			try {
				const { data, error } = await withTimeout(
					supabase.auth.getSession(),
					SESSION_TIMEOUT_MS,
					'auth.getSession'
				);
				if (error) {
					syncDebug('auth-session-sync-error', { reason, error });
					return;
				}
				this.session = data.session;
				this.user = data.session?.user ?? null;
				syncDebug('auth-session-sync', {
					reason,
					hasSession: !!this.session,
					userId: this.user?.id
				});
			} catch (err) {
				syncDebug('auth-session-sync-timeout', {
					reason,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		};

		const syncVisibleSession = () => {
			if (document.visibilityState === 'visible') void syncSession('visible');
		};
		const syncActiveSession = () => void syncSession('active');

		window.addEventListener('focus', syncActiveSession);
		window.addEventListener('pageshow', syncActiveSession);
		window.addEventListener('online', syncActiveSession);
		document.addEventListener('visibilitychange', syncVisibleSession);

		this.#stopSessionWatchers = () => {
			window.removeEventListener('focus', syncActiveSession);
			window.removeEventListener('pageshow', syncActiveSession);
			window.removeEventListener('online', syncActiveSession);
			document.removeEventListener('visibilitychange', syncVisibleSession);
		};
	}
}

function localizeAuthError(message: string, status?: number): string {
	const m = message.toLowerCase();
	if (status === 429 || m.includes('rate limit') || m.includes('too many')) {
		return 'Слишком много запросов. Попробуй через минуту.';
	}
	if (m.includes('invalid email') || m.includes('email_address_invalid')) {
		return 'Некорректный email.';
	}
	if (m.includes('email not confirmed') || m.includes('email_not_confirmed')) {
		return 'Email не подтверждён. Проверь почту.';
	}
	if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
		return 'Регистрация отключена.';
	}
	if (m.includes('network') || m.includes('failed to fetch')) {
		return 'Нет связи. Проверь интернет.';
	}
	if (m.includes('user not found')) {
		return 'Пользователь не найден.';
	}
	if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
		return 'Неверный email или пароль.';
	}
	return 'Не удалось войти. Попробуй позже.';
}

export const authStore = new AuthStore();
