/**
 * Индекс корневой вкладки нижней навигации (0–4). Совпадает с порядком в BottomNav.
 */
export function mainTabIndex(pathname: string, basePath: string): number | null {
	const p = pathname;
	if (p === `${basePath}/` || p === basePath || p.startsWith(`${basePath}/day/`)) return 0;
	if (p.startsWith(`${basePath}/sport`)) return 1;
	if (p.startsWith(`${basePath}/tasks`)) return 2;
	if (p.startsWith(`${basePath}/journal`)) return 3;
	if (p.startsWith(`${basePath}/profile`)) return 4;
	return null;
}
