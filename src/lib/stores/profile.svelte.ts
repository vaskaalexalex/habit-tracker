import { fetchUserProfile, upsertUserProfile } from '$supabase/api';
import { isSupabaseConfigured } from '$supabase/client';
import type { UUID } from '$supabase/types';

const LEGACY_STORAGE_KEY = 'habits-profile-name';

class ProfileStore {
	name = $state<string>('');

	init(): void {
		if (typeof window === 'undefined') return;
		this.name = localStorage.getItem(LEGACY_STORAGE_KEY) ?? '';
	}

	clear(): void {
		this.name = '';
		if (typeof window !== 'undefined') {
			localStorage.removeItem(LEGACY_STORAGE_KEY);
		}
	}

	async loadFromRemote(userId: UUID): Promise<void> {
		if (!isSupabaseConfigured) return;
		try {
			const row = await fetchUserProfile(userId);
			if (row?.display_name?.trim()) {
				this.name = row.display_name.trim();
				if (typeof window !== 'undefined') {
					localStorage.setItem(LEGACY_STORAGE_KEY, this.name);
				}
			}
		} catch (err) {
			console.warn('[profile.loadFromRemote]', err);
		}
	}

	async setName(value: string, userId: UUID | null): Promise<{ error?: string }> {
		const next = value.trim();
		this.name = next;
		if (typeof window !== 'undefined') {
			if (next) localStorage.setItem(LEGACY_STORAGE_KEY, next);
			else localStorage.removeItem(LEGACY_STORAGE_KEY);
		}
		if (!userId || !isSupabaseConfigured) return {};
		try {
			await upsertUserProfile({ id: userId, display_name: next });
			return {};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Не удалось сохранить имя';
			return { error: message };
		}
	}
}

export const profileStore = new ProfileStore();
