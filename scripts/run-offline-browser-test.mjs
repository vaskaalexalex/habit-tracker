/**
 * Starts Vite with non-placeholder Supabase env (required for auth init),
 * seeds habits-auth, toggles Playwright offline, reloads — must not land on /login.
 *
 * NOTE: Server runs only for the duration of this script (default port 5179).
 * For manual browsing use: `pnpm dev` → http://localhost:5173 (not 5179).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.OFFLINE_TEST_PORT ?? '5179');
const BASE = `http://127.0.0.1:${PORT}`;

function makeUnsignedJwt(payload) {
	const enc = (obj) =>
		Buffer.from(JSON.stringify(obj))
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
	return `${enc({ alg: 'none', typ: 'JWT' })}.${enc(payload)}.x`;
}

async function waitForServer(url, maxMs = 90_000) {
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
		refresh_token: 'test-refresh-token-offline-verify',
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

const child = spawn('pnpm', ['exec', 'vite', 'dev', '--host', '127.0.0.1', `--port`, String(PORT)], {
	cwd: root,
	env: {
		...process.env,
		PUBLIC_SUPABASE_URL: 'https://offline-verify.supabase.co',
		PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key-not-placeholder'
	},
	stdio: ['ignore', 'pipe', 'pipe']
});

let stderr = '';
child.stderr?.on('data', (c) => {
	stderr += String(c);
});

try {
	await waitForServer(BASE);
	console.log('[run-offline-browser-test] dev server up at', BASE);

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();

	// Playwright setOffline() blocks loopback too — use navigator.onLine=false like real "offline app open"
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
	await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90_000 });
	await page.waitForTimeout(2500);

	const url = page.url();
	if (url.includes('/login')) {
		console.error('FAIL: offline reload landed on login:', url);
		console.error('vite stderr (tail):', stderr.slice(-2000));
		process.exit(1);
	}

	console.log('PASS: offline reload OK →', url);
	console.log(
		'Tip: this script stops the server when done. Manual UI: pnpm dev → http://localhost:5173'
	);

	const log = await page.evaluate(() => window.localStorage.getItem('habit-sync-debug-log'));
	if (log) {
		try {
			const tail = JSON.parse(log).slice(-8);
			console.log('sync-debug tail:', JSON.stringify(tail, null, 2));
		} catch {
			/* ignore */
		}
	}

	await browser.close();
} finally {
	child.kill('SIGTERM');
	await delay(500);
	try {
		child.kill('SIGKILL');
	} catch {
		/* */
	}
}
