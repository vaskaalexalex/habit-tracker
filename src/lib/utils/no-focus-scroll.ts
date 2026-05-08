/**
 * Svelte action: подавляет автоскролл viewport'а при фокусе на input.
 *
 * iOS Safari при фокусе на input принудительно скроллит страницу так,
 * чтобы инпут оказался над виртуальной клавиатурой. На компактных
 * сетках (например, строка `вес/подходы`) это создаёт прыгающий UX,
 * хотя инпут уже виден на экране. Action восстанавливает scrollY
 * на нескольких rAF/таймаутах, перебивая поведение Safari.
 *
 * Никаких side-эффектов на десктопе и Android: там focus обычно не
 * двигает viewport, и повторный scrollTo на ту же позицию — no-op.
 */
export function noFocusScroll(node: HTMLElement) {
	function onFocus() {
		if (typeof window === 'undefined') return;
		const y = window.scrollY;
		const x = window.scrollX;
		const restore = () => window.scrollTo(x, y);

		requestAnimationFrame(() => {
			restore();
			requestAnimationFrame(restore);
		});
		// iOS подгоняет scroll по таймеру после показа клавиатуры
		const t1 = window.setTimeout(restore, 80);
		const t2 = window.setTimeout(restore, 240);
		const t3 = window.setTimeout(restore, 480);

		const cleanup = () => {
			window.clearTimeout(t1);
			window.clearTimeout(t2);
			window.clearTimeout(t3);
			node.removeEventListener('blur', cleanup);
		};
		node.addEventListener('blur', cleanup, { once: true });
	}

	node.addEventListener('focus', onFocus);
	return {
		destroy() {
			node.removeEventListener('focus', onFocus);
		}
	};
}
