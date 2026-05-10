/**
 * Compare pathnames as the same route (trailing slashes ignored).
 * After stripping, empty string is treated as root `/`.
 */
export function isSamePathname(a: string, b: string): boolean {
	const norm = (p: string) => {
		const t = p.replace(/\/+$/, '');
		return t === '' ? '/' : t;
	};
	return norm(a) === norm(b);
}
