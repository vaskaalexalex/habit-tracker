import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

export type AppSupabaseClient = SupabaseClient;

const url = env.PUBLIC_SUPABASE_URL ?? '';
const key = env.PUBLIC_SUPABASE_ANON_KEY ?? '';

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
			storageKey: 'habits-auth'
		},
		global: {
			headers: { 'x-client-info': 'habit-tracker' }
		}
	}
);

export const isSupabaseConfigured = !isPlaceholder;
