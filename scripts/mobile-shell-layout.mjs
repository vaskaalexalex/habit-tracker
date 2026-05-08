/**
 * Playwright: emulate iPhone viewport and assert the fixed bottom nav is flush with
 * the visual bottom (no stray gap band). Run after build:
 *
 *   pnpm build && node scripts/mobile-shell-layout.mjs
 *
 * Starts vite preview on a random localhost port.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, devices, webkit } from 'playwright';

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

const child = spawn(
	'pnpm',
	['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
	{
		cwd: root,
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env }
	}
);

child.stderr?.on('data', (d) => process.stderr.write(d));
child.stdout?.on('data', (d) => process.stderr.write(d));

async function measureBottomNav(page, label, browserName) {
	const result = await page.evaluate(
		({ currentLabel, currentBrowserName }) => {
			const inner = window.innerHeight;
			const width = window.innerWidth;
			const nav = document.querySelector('nav[aria-label="Основная навигация"]');
			if (!nav) return { ok: false, reason: 'nav missing', label: currentLabel };
			const navRect = nav.getBoundingClientRect();
			const navGapPx = inner - navRect.bottom;
			const lowerBandY = Math.max(0, inner - 2);
			const lowerBandTop = Math.max(0, inner - 18);
			const lowerBandSamples = [2, width / 2, width - 2].map((x) => {
				const topElement = document.elementFromPoint(x, lowerBandY);
				return {
					x,
					tag: topElement?.tagName.toLowerCase() ?? null,
					isNav: !!topElement?.closest?.('nav[aria-label="Основная навигация"]')
				};
			});
			const navCoversBottomBand =
				navRect.top <= lowerBandTop && navRect.bottom >= inner - 1 && navRect.height >= 40;
			const htmlInlineHeight = document.documentElement.style.height;
			const styles = getComputedStyle(document.documentElement);
			const bodyStyles = getComputedStyle(document.body);
			const shell = document.querySelector('.app-shell');
			const shellStyles = shell ? getComputedStyle(shell) : null;
			const vv = window.visualViewport;
			return {
				ok: true,
				label: currentLabel,
				browserName: currentBrowserName,
				inner,
				visualViewportHeight: vv?.height ?? null,
				navBottom: navRect.bottom,
				navGapPx,
				navHeight: navRect.height,
				navCoversBottomBand,
				lowerBandSamples,
				htmlInlineHeight,
				bodyHasBgBgClass: document.body.classList.contains('bg-bg'),
				bodyBackground: bodyStyles.backgroundColor,
				shellBackground: shellStyles?.backgroundColor ?? null,
				bottomNavOuterHeight: styles.getPropertyValue('--bottom-nav-outer-height').trim()
			};
		},
		{ currentLabel: label, currentBrowserName: browserName }
	);

	if (!result.ok) {
		throw new Error(`${browserName}/${result.label}: ${result.reason ?? 'evaluation failed'}`);
	}

	const tol = 4;
	if (Math.abs(result.navGapPx) > tol) {
		throw new Error(
			`${browserName}/${result.label}: bottom nav gap too large: gapPx=${result.navGapPx.toFixed(2)} inner=${result.inner} navBottom=${result.navBottom} (expected |gap| <= ${tol})`
		);
	}

	if (!result.navCoversBottomBand) {
		throw new Error(
			`${browserName}/${result.label}: bottom nav does not cover viewport bottom: navBottom=${result.navBottom.toFixed(2)} navHeight=${result.navHeight.toFixed(2)} inner=${result.inner}`
		);
	}

	if (result.htmlInlineHeight) {
		throw new Error(
			`${browserName}/${result.label}: stale html inline height remains: ${result.htmlInlineHeight}`
		);
	}

	if (result.bodyHasBgBgClass) {
		throw new Error(`${browserName}/${result.label}: body must not use bg-bg over iOS unsafe area`);
	}

	return result;
}

async function runSuite(browserType, browserName) {
	let browser;
	try {
		const device = devices['iPhone 12'];
		browser = await browserType.launch();
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

		const initial = await measureBottomNav(page, 'initial', browserName);

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

		const afterBlur = await measureBottomNav(page, 'after focus/blur', browserName);

		console.log(
			`${browserName}: mobile-shell-layout OK: initial navGap=${initial.navGapPx.toFixed(2)}px navHeight=${initial.navHeight.toFixed(2)}px afterBlur navGap=${afterBlur.navGapPx.toFixed(2)}px innerHeight=${afterBlur.inner}`
		);
	} finally {
		await browser?.close();
	}
}

try {
	await waitForServer(BASE);

	await runSuite(chromium, 'chromium');
	await runSuite(webkit, 'webkit');
} finally {
	child.kill('SIGTERM');
	await delay(400);
	try {
		child.kill('SIGKILL');
	} catch {
		/* already dead */
	}
}
