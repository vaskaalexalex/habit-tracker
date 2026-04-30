class ProfileStore {
	name = $state<string>('');

	init(): void {
		if (typeof window === 'undefined') return;
		this.name = localStorage.getItem('habits-profile-name') ?? '';
	}

	setName(value: string): void {
		this.name = value;
		if (typeof window !== 'undefined') {
			if (value.trim()) localStorage.setItem('habits-profile-name', value);
			else localStorage.removeItem('habits-profile-name');
		}
	}
}

export const profileStore = new ProfileStore();
