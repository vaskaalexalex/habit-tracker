import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '$supabase/client';

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

	async init(): Promise<void> {
		if (this.initialized) return;
		if (!isSupabaseConfigured) {
			this.initialized = true;
			this.loading = false;
			return;
		}

		this.loading = true;
		const { data } = await supabase.auth.getSession();
		this.session = data.session;
		this.user = data.session?.user ?? null;

		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			this.session = session;
			this.user = session?.user ?? null;
		});
		this.#unsubscribe = () => sub.subscription.unsubscribe();
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
