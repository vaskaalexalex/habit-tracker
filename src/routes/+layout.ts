import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = true;
export const trailingSlash = 'never';

export const load: LayoutLoad = async () => {
	return {};
};
