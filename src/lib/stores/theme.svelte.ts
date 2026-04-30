class ThemeStore {
	theme = $state<'dark' | 'light'>('dark');
	#initialized = false;

	init(): void {
		if (this.#initialized || typeof window === 'undefined') return;
		this.#initialized = true;
		const saved = window.localStorage.getItem('theme');
		const initial = saved === 'light' || saved === 'dark' ? saved : 'dark';
		this.theme = initial;
		document.documentElement.dataset.theme = initial;
	}

	toggle(): void {
		const next = this.theme === 'dark' ? 'light' : 'dark';
		this.theme = next;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem('theme', next);
			document.documentElement.dataset.theme = next;
		}
	}
}

export const themeStore = new ThemeStore();
