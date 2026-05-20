import { format, parseISO, startOfMonth, subMonths, eachDayOfInterval, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { ISODate } from '$supabase/types';

export function isoToday(): ISODate {
	return format(new Date(), 'yyyy-MM-dd');
}

export function toISO(date: Date): ISODate {
	return format(date, 'yyyy-MM-dd');
}

export function fromISO(date: ISODate): Date {
	return parseISO(date);
}

export function rangeISO(from: Date, to: Date): ISODate[] {
	return eachDayOfInterval({ start: from, end: to }).map(toISO);
}

export function lastNMonthsRange(n: number, refDate: Date = new Date()): { from: Date; to: Date } {
	return {
		from: startOfMonth(subMonths(refDate, n - 1)),
		to: refDate
	};
}

export function shiftDays(date: ISODate, delta: number): ISODate {
	return toISO(addDays(parseISO(date), delta));
}

export function formatRu(date: ISODate | Date, pattern = 'd MMMM yyyy'): string {
	const d = typeof date === 'string' ? parseISO(date) : date;
	return format(d, pattern, { locale: ru });
}

export function formatRuShort(date: ISODate | Date): string {
	return formatRu(date, 'd MMM');
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: string): value is ISODate {
	return ISO_DATE_RE.test(value);
}

/** Kicker for home header: «Сегодня», «Вчера» or weekday name. */
export function dayHeadKicker(iso: ISODate, today: ISODate): string {
	if (iso === today) return 'Сегодня';
	if (iso === shiftDays(today, -1)) return 'Вчера';
	const label = formatRu(iso, 'EEEE');
	return label.charAt(0).toLocaleUpperCase('ru') + label.slice(1);
}
