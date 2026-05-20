import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { isISODate } from '$utils/dates';
import type { PageLoad } from './$types';

export const prerender = false;
export const ssr = false;

export const load: PageLoad = ({ params }) => {
	const date = params.date ?? '';
	if (!isISODate(date)) {
		throw redirect(307, `${base}/`);
	}
	throw redirect(307, `${base}/?date=${date}`);
};
