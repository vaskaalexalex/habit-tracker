import type { Action } from 'svelte/action';

export interface LongPressParams {
	/** Called once when the press is held past `duration` without moving. */
	onLongPress: (event: { x: number; y: number }) => void;
	/** Hold time in ms before firing. */
	duration?: number;
	/** Movement (px) that cancels the gesture (treated as a scroll). */
	moveTolerance?: number;
}

/**
 * Long-press gesture for touch and mouse. Fires `onLongPress` after the pointer
 * is held still for `duration` ms. Suppresses the native context menu so an
 * iOS/Android long-press opens our own action sheet instead.
 */
export const longpress: Action<HTMLElement, LongPressParams> = (node, params) => {
	let opts = params;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let startX = 0;
	let startY = 0;
	let fired = false;

	function clear() {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button != null && e.button !== 0) return;
		fired = false;
		startX = e.clientX;
		startY = e.clientY;
		clear();
		timer = setTimeout(() => {
			fired = true;
			opts.onLongPress({ x: startX, y: startY });
		}, opts.duration ?? 450);
	}

	function onPointerMove(e: PointerEvent) {
		if (timer === null) return;
		const tol = opts.moveTolerance ?? 10;
		if (Math.abs(e.clientX - startX) > tol || Math.abs(e.clientY - startY) > tol) clear();
	}

	function onPointerUp() {
		clear();
	}

	function onContextMenu(e: Event) {
		// Block the OS context menu / text-selection callout for the long-press target.
		e.preventDefault();
	}

	function onClickCapture(e: MouseEvent) {
		// Swallow the click that follows a successful long-press.
		if (fired) {
			e.stopPropagation();
			e.preventDefault();
			fired = false;
		}
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', onPointerUp);
	node.addEventListener('pointercancel', onPointerUp);
	node.addEventListener('pointerleave', onPointerUp);
	node.addEventListener('contextmenu', onContextMenu);
	node.addEventListener('click', onClickCapture, true);

	return {
		update(next: LongPressParams) {
			opts = next;
		},
		destroy() {
			clear();
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerUp);
			node.removeEventListener('pointercancel', onPointerUp);
			node.removeEventListener('pointerleave', onPointerUp);
			node.removeEventListener('contextmenu', onContextMenu);
			node.removeEventListener('click', onClickCapture, true);
		}
	};
};
