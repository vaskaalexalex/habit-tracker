<script lang="ts">
	import type { JournalEntry, ISODate } from '$supabase/types';

	interface Props {
		date: ISODate;
		initial: JournalEntry | null;
		onsave: (input: { content: string; mood: number | null }) => Promise<void>;
		/** Persist clearing the day (delete row + undo habit); only fired after non-empty persisted baseline. */
		onclear: () => Promise<void>;
	}

	import { untrack } from 'svelte';

	function journalSnapshotKey(content: string, mood: number | null): string {
		return `${content.trim()}\u0000${mood === null ? '' : String(mood)}`;
	}

	function baselineMoodFromInitial(entry: JournalEntry | null): number | null {
		return entry?.mood != null ? entry.mood : null;
	}

	let { date, initial, onsave, onclear }: Props = $props();

	let content = $state(untrack(() => initial?.content ?? ''));
	let moodValue = $state<number>(untrack(() => initial?.mood ?? 5));
	let moodTouched = $state<boolean>(untrack(() => initial?.mood != null));
	let saving = $state(false);
	let savedAt = $state<number | null>(untrack(() => (initial ? Date.now() : null)));

	let timer: ReturnType<typeof setTimeout> | null = null;
	let initialKey = $state(
		untrack(() => `${date}|${initial?.content ?? ''}|${initial?.mood ?? ''}`)
	);
	let saveBaselineKey = $state(
		untrack(() =>
			journalSnapshotKey(initial?.content ?? '', baselineMoodFromInitial(initial))
		)
	);

	$effect(() => {
		const nextKey = `${date}|${initial?.content ?? ''}|${initial?.mood ?? ''}`;
		if (nextKey !== initialKey) {
			initialKey = nextKey;
			content = initial?.content ?? '';
			moodValue = initial?.mood ?? 5;
			moodTouched = initial?.mood != null;
			savedAt = initial ? Date.now() : null;
			saveBaselineKey = journalSnapshotKey(content, baselineMoodFromInitial(initial));
		}
	});

	const moodForSave = $derived<number | null>(moodTouched ? moodValue : null);
	const fillPct = $derived((moodValue / 10) * 100);

	$effect(() => {
		const c = content;
		const m = moodForSave;
		void date;
		void saveBaselineKey;
		void initial;

		const clearScheduled = () => {
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
		};
		clearScheduled();

		const snap = journalSnapshotKey(c, m);
		if (snap === saveBaselineKey) {
			return clearScheduled;
		}

		const empty = c.trim().length === 0 && m === null;
		const initialMeaningful =
			initial != null &&
			(initial.content.trim().length > 0 || initial.mood != null);
		const shouldClearPersisted =
			empty &&
			(journalSnapshotKey('', null) !== saveBaselineKey || initialMeaningful);

		if (empty && !shouldClearPersisted) {
			return clearScheduled;
		}

		timer = setTimeout(async () => {
			saving = true;
			try {
				if (empty) {
					await onclear();
					saveBaselineKey = journalSnapshotKey('', null);
				} else {
					await onsave({ content: c, mood: m });
					saveBaselineKey = snap;
				}
				savedAt = Date.now();
			} finally {
				saving = false;
				timer = null;
			}
		}, 800);

		return clearScheduled;
	});

	function relativeSaved(): string {
		if (saving) return 'Сохраняем…';
		if (!savedAt) return '';
		const sec = Math.round((Date.now() - savedAt) / 1000);
		if (sec < 5) return 'Сохранено';
		if (sec < 60) return `Сохранено ${sec}с назад`;
		return 'Сохранено';
	}

	function markTouched() {
		if (!moodTouched) moodTouched = true;
	}
</script>

<div class="hairline flex flex-col gap-3 rounded-3xl bg-(--color-bg-soft) p-4">
	<div class="flex items-center justify-between text-xs text-(--color-fg-mute)">
		<span>Запись • {date}</span>
		<span>{relativeSaved()}</span>
	</div>
	<textarea
		bind:value={content}
		placeholder="Что произошло сегодня? Чем горжусь, что хочу повторить, что улучшить…"
		rows="6"
		class="w-full resize-y rounded-2xl bg-(--color-bg-mute) p-3 text-base leading-relaxed outline-none placeholder:text-(--color-fg-mute)"
	></textarea>

	<div class="flex flex-col gap-2">
		<div class="flex items-baseline justify-between">
			<span class="text-xs text-(--color-fg-mute)">Оценка дня</span>
			<span class="font-semibold tabular-nums">
				<span class="text-base text-(--color-fg)" class:dim={!moodTouched}>
					{moodValue}
				</span>
				<span class="text-xs text-(--color-fg-mute)">/ 10</span>
			</span>
		</div>

		<input
			type="range"
			min="0"
			max="10"
			step="1"
			bind:value={moodValue}
			oninput={markTouched}
			onpointerdown={markTouched}
			onkeydown={markTouched}
			style="--mood-pct: {fillPct}%"
			class="mood-slider"
			class:idle={!moodTouched}
			aria-label="Оценка дня от 0 до 10"
			aria-valuenow={moodValue}
			aria-valuemin="0"
			aria-valuemax="10"
		/>

		<div class="flex justify-between px-0.5 text-[10px] text-(--color-fg-mute) tabular-nums">
			<span>0</span>
			<span>5</span>
			<span>10</span>
		</div>
	</div>
</div>

<style>
	.dim {
		opacity: 0.45;
	}

	.mood-slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 8px;
		border-radius: 999px;
		background: linear-gradient(
			to right,
			var(--color-accent) 0%,
			var(--color-accent) var(--mood-pct, 50%),
			var(--color-bg-mute) var(--mood-pct, 50%),
			var(--color-bg-mute) 100%
		);
		outline: none;
		cursor: pointer;
		touch-action: none;
		transition: filter 0.2s ease;
	}

	.mood-slider.idle {
		filter: saturate(0.4) brightness(0.92);
	}

	.mood-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--color-accent);
		border: 3px solid var(--color-bg);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		cursor: grab;
		transition: transform 0.15s ease;
	}

	.mood-slider::-webkit-slider-thumb:active {
		cursor: grabbing;
		transform: scale(1.15);
	}

	.mood-slider::-moz-range-thumb {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--color-accent);
		border: 3px solid var(--color-bg);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		cursor: grab;
		transition: transform 0.15s ease;
	}

	.mood-slider::-moz-range-thumb:active {
		cursor: grabbing;
		transform: scale(1.15);
	}

	.mood-slider:focus-visible::-webkit-slider-thumb {
		box-shadow:
			0 0 0 4px var(--color-accent-soft),
			0 2px 8px rgba(0, 0, 0, 0.25);
	}

	.mood-slider:focus-visible::-moz-range-thumb {
		box-shadow:
			0 0 0 4px var(--color-accent-soft),
			0 2px 8px rgba(0, 0, 0, 0.25);
	}
</style>
