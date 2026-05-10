/**
 * Default Web Push VAPID **public** key (not secret — same value is sent to the browser).
 * Override with `PUBLIC_VAPID_PUBLIC_KEY` in `.env` / CI when you rotate keys; must match
 * the private key configured for Edge (`VAPID_PRIVATE_KEY` / Vault `edge_vapid_private_key`).
 */
export const DEFAULT_VAPID_PUBLIC_KEY =
	'BJly2WmDgM_c6talZrqHy5lrjfDmJ0ykkIxWdOcDf3EC9XiR3Q1KpFjynxtVfk3hGKcXCb9UYCG9x1j15TZ_jbI';
