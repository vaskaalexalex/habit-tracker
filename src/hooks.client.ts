import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = ({ error, event }) => {
	console.error('[client error]', event?.url?.pathname, error);
	return {
		message: 'Что-то пошло не так'
	};
};
