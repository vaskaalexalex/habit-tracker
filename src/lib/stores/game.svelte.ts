import { HABIT_ORDER } from '$supabase/types';
import { habitsStore } from '$stores/habits.svelte';
import { strengthStore } from '$stores/strength.svelte';
import { cardioStore } from '$stores/cardio.svelte';
import { journalStore } from '$stores/journal.svelte';
import { tasksStore } from '$stores/tasks.svelte';
import { todayStore } from '$stores/today.svelte';

/** Сколько XP в одном уровне (совпадает с подачей мока «XP 340/500»). */
const xpPerLevel = 500;

/**
 * Производная геймификация скина «Аркада»: XP/уровень/комбо/монеты считаются
 * из уже существующих данных сторов. Никаких новых таблиц и миграций.
 */
class GameStore {
	/** Суммарный опыт: привычки + силовые дни + кардио + записи дневника + закрытые задачи. */
	get totalXp(): number {
		const habits = habitsStore.completions.length * 10;
		const strengthDays = new Set(strengthStore.sets.map((s) => s.date)).size * 25;
		const cardio = cardioStore.items.length * 15;
		const journal = journalStore.entries.length * 12;
		const tasksDone = tasksStore.tasks.filter((t) => t.status === 'done').length * 20;
		return habits + strengthDays + cardio + journal + tasksDone;
	}

	get level(): number {
		return Math.floor(this.totalXp / xpPerLevel) + 1;
	}

	get xpIntoLevel(): number {
		return this.totalXp % xpPerLevel;
	}

	get xpForNextLevel(): number {
		return xpPerLevel;
	}

	/** Монеты-«очки»: сумма закрытых привычек и задач. */
	get coins(): number {
		return (
			habitsStore.completions.length + tasksStore.tasks.filter((t) => t.status === 'done').length
		);
	}

	/** Комбо = максимальная текущая серия среди привычек на сегодня. */
	get combo(): number {
		const today = todayStore.today;
		let max = 0;
		for (const habit of HABIT_ORDER) {
			max = Math.max(max, habitsStore.streak(habit, today));
		}
		return max;
	}
}

export const gameStore = new GameStore();
