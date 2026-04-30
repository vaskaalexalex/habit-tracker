export function uuid(): string {
	const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
	if (c && typeof c.randomUUID === 'function') {
		return c.randomUUID();
	}
	const bytes = new Uint8Array(16);
	if (c && typeof c.getRandomValues === 'function') {
		c.getRandomValues(bytes);
	} else {
		for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
	}
	const b0 = bytes[0] ?? 0;
	const b1 = bytes[1] ?? 0;
	const b2 = bytes[2] ?? 0;
	const b3 = bytes[3] ?? 0;
	const b4 = bytes[4] ?? 0;
	const b5 = bytes[5] ?? 0;
	const b6 = bytes[6] ?? 0;
	const b7 = bytes[7] ?? 0;
	const b8 = bytes[8] ?? 0;
	const b9 = bytes[9] ?? 0;
	const b10 = bytes[10] ?? 0;
	const b11 = bytes[11] ?? 0;
	const b12 = bytes[12] ?? 0;
	const b13 = bytes[13] ?? 0;
	const b14 = bytes[14] ?? 0;
	const b15 = bytes[15] ?? 0;
	bytes[6] = (b6 & 0x0f) | 0x40;
	bytes[8] = (b8 & 0x3f) | 0x80;
	const hex = (n: number) => n.toString(16).padStart(2, '0');
	return (
		hex(b0) +
		hex(b1) +
		hex(b2) +
		hex(b3) +
		'-' +
		hex(b4) +
		hex(b5) +
		'-' +
		hex(bytes[6] ?? 0) +
		hex(b7) +
		'-' +
		hex(bytes[8] ?? 0) +
		hex(b9) +
		'-' +
		hex(b10) +
		hex(b11) +
		hex(b12) +
		hex(b13) +
		hex(b14) +
		hex(b15)
	);
}
