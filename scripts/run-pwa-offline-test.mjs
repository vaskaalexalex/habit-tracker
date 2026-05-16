/**
 * Production PWA shell test: build with BASE_PATH, preview, install SW online,
 * then reload offline — app shell must load (not blank, not /login with seeded auth).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PWA_OFFLINE_TEST_PORT ?? '5180');
const BASE_PATH = process.env.BASE_PATH ?? '/habit-tracker';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const START_URL = `${ORIGIN}${BASE_PATH}/`;

const testEnv = {
	...process.env,
	BASE_PATH,
	PUBLIC_SUPABASE_URL: 'https://offline-verify.supabase.co',
	PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-not-placeholder'
};

function makeUnsignedJwt(payload) {
	const enc = (obj) =>
		Buffer.from(JSON.stringify(obj))
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
	return `${enc({ alg: 'none', typ: 'JWT' })}.${enc(payload)}.x`;
}

async function waitForServer(url, maxMs = 120_000) {
	const start = Date.now();
	while (Date.now() - start < maxMs) {
		try {
			const r = await fetch(url);
			if (r.ok || r.status === 404) return;
		} catch {
			/* waiting */
		}
		await delay(400);
	}
	throw new Error(`Server did not respond at ${url}`);
}

function run(cmd, args, opts = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', env: testEnv, ...opts });
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`));
		});
	});
}

const userId = '11111111-1111-1111-1111-111111111111';
const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
const access_token = makeUnsignedJwt({
	sub: userId,
	exp,
	aud: 'authenticated',
	role: 'authenticated',
	email: 'browser-test@example.com'
});

const storageBlob = JSON.stringify({
	currentSession: {
		access_token,
		refresh_token: 'test-refresh-token-pwa-offline',
		expires_in: 3600,
		expires_at: exp,
		token_type: 'bearer',
		user: {
			id: userId,
			aud: 'authenticated',
			role: 'authenticated',
			email: 'browser-test@example.com',
			app_metadata: {},
			user_metadata: {},
			created_at: '2025-01-01T00:00:00.000Z',
			updated_at: '2025-01-01T00:00:00.000Z'
		}
	}
});

console.log('[run-pwa-offline-test] building with BASE_PATH=', BASE_PATH);
await run('pnpm', ['build']);

const preview = spawn(
	'pnpm',
	['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)],
	{ cwd: root, env: testEnv, stdio: ['ignore', 'pipe', 'pipe'] }
);

let previewStderr = '';
preview.stderr?.on('data', (c) => {
	previewStderr += String(c);
});

try {
	await waitForServer(START_URL);
	console.log('[run-pwa-offline-test] preview up at', START_URL);

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	await context.addInitScript(
		({ blob, uid }) => {
			localStorage.setItem('habits-auth', blob);
			localStorage.setItem('habits-last-user-id', uid);
			try {
				Object.defineProperty(navigator, 'onLine', {
					configurable: true,
					enumerable: true,
					get: () => false
				});
			} catch {
				/* ignore */
			}
		},
		{ blob: storageBlob, uid: userId }
	);

	const page = await context.newPage();
	await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });

	const swScope = BASE_PATH.endsWith('/') ? BASE_PATH : `${BASE_PATH}/`;

	await page.waitForFunction(
		() => {
			const app = document.getElementById('app');
			const text = app?.textContent?.trim() ?? '';
			return app && app.dataset.offlineFallback !== '1' && text.length > 20 && !location.pathname.includes('/login');
		},
		undefined,
		{ timeout: 90_000 }
	);

	await page.waitForFunction(
		async (scope) => {
			if (!('serviceWorker' in navigator)) return false;
			const reg = await navigator.serviceWorker.getRegistration(scope);
			return !!reg?.active;
		},
		swScope,
		{ timeout: 90_000 }
	);

	const swCountOnline = await page.evaluate(async (scope) => {
		const reg = await navigator.serviceWorker.getRegistration(scope);
		return reg?.active ? 1 : 0;
	}, swScope);

	console.log('[run-pwa-offline-test] online boot OK, SW active:', swCountOnline === 1);

	// Playwright setOffline() blocks loopback — SW cannot serve precache. Block external only.
	await context.route('**/*', (route) => {
		const host = new URL(route.request().url()).hostname;
		if (host === '127.0.0.1' || host === 'localhost') {
			void route.continue();
			return;
		}
		void route.abort('failed');
	});

	await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
	await page.waitForFunction(
		() => {
			const app = document.getElementById('app');
			const text = app?.textContent?.trim() ?? '';
			return app && app.dataset.offlineFallback !== '1' && text.length > 20 && !location.pathname.includes('/login');
		},
		undefined,
		{ timeout: 90_000 }
	);

	const url = page.url();
	const bodyText = await page.evaluate(() => document.body?.innerText?.trim() ?? '');
	const offlineFallback = await page.evaluate(
		() => document.getElementById('app')?.dataset.offlineFallback === '1'
	);
	const swStillThere = await page.evaluate(async (scope) => {
		const regs = await navigator.serviceWorker.getRegistrations();
		return regs.some((r) => r.scope.includes(scope.replace(/\/$/, '')));
	}, BASE_PATH);

	if (url.includes('/login')) {
		console.error('FAIL: offline reload landed on login:', url);
		process.exit(1);
	}
	if (offlineFallback || bodyText.length < 10) {
		console.error('FAIL: offline reload blank or shell fallback. body length:', bodyText.length);
		console.error('preview stderr (tail):', previewStderr.slice(-2000));
		process.exit(1);
	}
	if (!swStillThere) {
		console.error('FAIL: service worker was removed while offline');
		process.exit(1);
	}

	console.log('PASS: PWA offline reload OK →', url, '| body chars:', bodyText.length);
	await browser.close();
} finally {
	preview.kill('SIGTERM');
	await delay(500);
	try {
		preview.kill('SIGKILL');
	} catch {
		/* */
	}
}
