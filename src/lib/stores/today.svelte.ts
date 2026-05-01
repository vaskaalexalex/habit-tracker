import { isoToday } from '$utils/dates';

class TodayStore {
	today = $state(isoToday());
	#stop: (() => void) | null = null;

	start(): () => void {
		if (typeof window === 'undefined') return () => undefined;
		if (this.#stop) return this.#stop;

		const refresh = () => {
			this.today = isoToday();
		};
		const refreshWhenVisible = () => {
			if (document.visibilityState === 'visible') refresh();
		};

		window.addEventListener('focus', refresh);
		window.addEventListener('pageshow', refresh);
		document.addEventListener('visibilitychange', refreshWhenVisible);
		const interval = window.setInterval(refresh, 60_000);

		refresh();

		this.#stop = () => {
			window.removeEventListener('focus', refresh);
			window.removeEventListener('pageshow', refresh);
			document.removeEventListener('visibilitychange', refreshWhenVisible);
			window.clearInterval(interval);
			this.#stop = null;
		};

		return this.#stop;
	}
}

export const todayStore = new TodayStore();
