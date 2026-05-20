import type { ISODate } from '$supabase/types';
import { formatRu, isISODate } from '$utils/dates';

export function resolveViewDate(searchParams: URLSearchParams, today: ISODate): ISODate {
	const raw = searchParams.get('date');
	if (raw && isISODate(raw)) return raw;
	return today;
}

/** `?date=…` or empty when viewing today. */
export function viewDateQuery(date: ISODate, today: ISODate): string {
	if (date === today) return '';
	return `?date=${encodeURIComponent(date)}`;
}

export function withViewDate(path: string, date: ISODate, today: ISODate): string {
	const q = viewDateQuery(date, today);
	return q ? `${path}${q}` : path;
}

/** «Сегодня» / «15 мая» for subtitles. */
export function dayScopeLabel(date: ISODate, today: ISODate): string {
	if (date === today) return 'Сегодня';
	return formatRu(date, 'd MMMM');
}

/** «сегодня» / «15 мая» for inline badges. */
export function dayScopeBadge(date: ISODate, today: ISODate): string {
	if (date === today) return 'сегодня';
	return formatRu(date, 'd MMMM');
}

export function isViewingDate(
	searchParams: URLSearchParams,
	date: ISODate,
	today: ISODate
): boolean {
	if (date === today) return !searchParams.has('date');
	return searchParams.get('date') === date;
}
