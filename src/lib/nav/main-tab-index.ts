/**
 * Индекс корневой вкладки нижней навигации (0–3). Совпадает с порядком в BottomNav.
 */
export function mainTabIndex(pathname: string, basePath: string): number | null {
	const p = pathname;
	if (p === `${basePath}/` || p === basePath || p.startsWith(`${basePath}/day/`)) return 0;
	if (p.startsWith(`${basePath}/sport`)) return 1;
	if (p.startsWith(`${basePath}/journal`)) return 2;
	if (p.startsWith(`${basePath}/profile`)) return 3;
	return null;
}
