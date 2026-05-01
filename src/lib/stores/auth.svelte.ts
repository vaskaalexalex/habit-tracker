import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '$supabase/client';
import { syncDebug } from '$utils/sync-debug';

export interface AuthState {
	user: User | null;
	session: Session | null;
	loading: boolean;
	initialized: boolean;
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
		const { data } = await supabase.auth.getSession();
		this.session = data.session;
		this.user = data.session?.user ?? null;
		syncDebug('auth-session-loaded', { hasSession: !!this.session, userId: this.user?.id });

		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			this.session = session;
			this.user = session?.user ?? null;
			syncDebug('auth-state-change', { hasSession: !!session, userId: this.user?.id });
		});
		this.#unsubscribe = () => sub.subscription.unsubscribe();
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
			const { data, error } = await supabase.auth.getSession();
			if (error) {
				syncDebug('auth-session-sync-error', { reason, error });
				return;
			}
			this.session = data.session;
			this.user = data.session?.user ?? null;
			syncDebug('auth-session-sync', { reason, hasSession: !!this.session, userId: this.user?.id });
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
