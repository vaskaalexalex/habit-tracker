type Skin = 'classic' | 'arcade';

class SkinStore {
	skin = $state<Skin>('classic');
	#initialized = false;

	init(): void {
		if (this.#initialized || typeof window === 'undefined') return;
		this.#initialized = true;
		const saved = window.localStorage.getItem('skin');
		const initial: Skin = saved === 'arcade' || saved === 'classic' ? saved : 'classic';
		this.skin = initial;
		document.documentElement.dataset.skin = initial;
	}

	set(next: Skin): void {
		this.skin = next;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem('skin', next);
			document.documentElement.dataset.skin = next;
		}
	}

	toggle(): void {
		this.set(this.skin === 'arcade' ? 'classic' : 'arcade');
	}
}

export const skinStore = new SkinStore();
