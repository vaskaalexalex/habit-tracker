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

let browser;

async function measureBottomNav(page, label) {
	const result = await page.evaluate((currentLabel) => {
		const inner = window.innerHeight;
		const nav = document.querySelector('nav[aria-label="Основная навигация"]');
		if (!nav) return { ok: false, reason: 'nav missing', label: currentLabel };
		const bottom = nav.getBoundingClientRect().bottom;
		const gapPx = inner - bottom;
		const htmlInlineHeight = document.documentElement.style.height;
		return { ok: true, label: currentLabel, inner, navBottom: bottom, gapPx, htmlInlineHeight };
	}, label);

	if (!result.ok) {
		throw new Error(`${result.label}: ${result.reason ?? 'evaluation failed'}`);
	}

	const tol = 4;
	if (Math.abs(result.gapPx) > tol) {
		throw new Error(
			`${result.label}: bottom nav gap too large: gapPx=${result.gapPx.toFixed(2)} inner=${result.inner} navBottom=${result.navBottom} (expected |gap| <= ${tol})`
		);
	}

	if (result.htmlInlineHeight) {
		throw new Error(`${result.label}: stale html inline height remains: ${result.htmlInlineHeight}`);
	}

	return result;
}

try {
	await waitForServer(BASE);

	const device = devices['iPhone 12'];
	browser = await chromium.launch();
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

	const initial = await measureBottomNav(page, 'initial');

	await page.evaluate(() => {
		const input = document.createElement('input');
		input.id = 'mobile-shell-keyboard-probe';
		input.type = 'text';
		input.style.position = 'fixed';
		input.style.left = '0';
		input.style.bottom = '0';
		input.style.width = '1px';
		input.style.height = '1px';
		input.style.opacity = '0';
		document.body.append(input);
		input.focus();
	});
	await page.waitForTimeout(50);
	await page.evaluate(() => {
		const input = document.querySelector('#mobile-shell-keyboard-probe');
		if (input instanceof HTMLInputElement) input.blur();
	});
	await page.waitForTimeout(900);

	const afterBlur = await measureBottomNav(page, 'after focus/blur');

	console.log(
		`mobile-shell-layout OK: initial gap=${initial.gapPx.toFixed(2)}px afterBlur gap=${afterBlur.gapPx.toFixed(2)}px innerHeight=${afterBlur.inner}`
	);
} finally {
	await browser?.close();
	child.kill('SIGTERM');
	await delay(400);
	try {
		child.kill('SIGKILL');
	} catch {
		/* already dead */
	}
}
