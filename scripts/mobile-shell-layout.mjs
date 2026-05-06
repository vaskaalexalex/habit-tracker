/**
 * Playwright: emulate iPhone viewport and assert the fixed bottom nav touches the
 * visual bottom (no stray gap band). Run after build:
 *
 *   pnpm build && node scripts/mobile-shell-layout.mjs
 *
 * Starts vite preview on a random localhost port.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, devices } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.MOBILE_SHELL_PORT ?? '4189');
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForServer(url, maxMs = 60_000) {
	const start = Date.now();
	while (Date.now() - start < maxMs) {
		try {
			const r = await fetch(url);
			if (r.ok || r.status === 404) return;
		} catch {
			/* waiting */
		}
		await delay(300);
	}
	throw new Error(`Server did not respond at ${url}`);
}

const child = spawn('pnpm', ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], {
	cwd: root,
	stdio: ['ignore', 'pipe', 'pipe'],
	env: { ...process.env }
});

child.stderr?.on('data', (d) => process.stderr.write(d));
child.stdout?.on('data', (d) => process.stderr.write(d));

try {
	await waitForServer(BASE);

	const device = devices['iPhone 12'];
	const browser = await chromium.launch();
	const context = await browser.newContext({
		...device,
		viewport: device.viewport,
		deviceScaleFactor: device.deviceScaleFactor,
		isMobile: true,
		hasTouch: true,
		locale: 'ru-RU'
	});
	const page = await context.newPage();

	await page.goto(`${BASE}/design-preview`, { waitUntil: 'networkidle', timeout: 60_000 });

	const result = await page.evaluate(() => {
		const inner = window.innerHeight;
		const nav = document.querySelector('nav[aria-label="Основная навигация"]');
		if (!nav) return { ok: false, reason: 'nav missing' };
		const bottom = nav.getBoundingClientRect().bottom;
		const gapPx = inner - bottom;
		return { ok: true, inner, navBottom: bottom, gapPx };
	});

	await browser.close();

	if (!result.ok) {
		throw new Error(result.reason ?? 'evaluation failed');
	}

	const tol = 4;
	if (Math.abs(result.gapPx) > tol) {
		throw new Error(
			`Bottom nav gap too large: gapPx=${result.gapPx.toFixed(2)} inner=${result.inner} navBottom=${result.navBottom} (expected |gap| ≤ ${tol})`
		);
	}

	console.log(
		`mobile-shell-layout OK: innerHeight=${result.inner} nav.bottom=${result.navBottom.toFixed(1)} gap=${result.gapPx.toFixed(2)}px`
	);
} finally {
	child.kill('SIGTERM');
	await delay(400);
	try {
		child.kill('SIGKILL');
	} catch {
		/* already dead */
	}
}
