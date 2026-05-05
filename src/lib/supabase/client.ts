import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';

export type AppSupabaseClient = SupabaseClient;

/** Must match `auth.storageKey` — used for offline session recovery */
export const AUTH_STORAGE_KEY = 'habits-auth';

const url = PUBLIC_SUPABASE_URL ?? '';
const key = PUBLIC_SUPABASE_ANON_KEY ?? '';

const isPlaceholder = !url || !key || url.includes('your-project-ref');

if (isPlaceholder && typeof window !== 'undefined') {
	console.warn(
		'[supabase] PUBLIC_SUPABASE_URL/ANON_KEY are missing or placeholders. Auth/sync disabled.'
	);
}

export const supabase: AppSupabaseClient = createClient(
	url || 'https://placeholder.supabase.co',
	key || 'placeholder-anon-key',
	{
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
			flowType: 'pkce',
			storageKey: AUTH_STORAGE_KEY
		},
		global: {
			headers: { 'x-client-info': 'habit-tracker' }
		}
	}
);

export const isSupabaseConfigured = !isPlaceholder;
