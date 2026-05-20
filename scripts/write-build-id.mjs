import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function resolveBuildId() {
	if (process.env.PUBLIC_APP_BUILD_ID?.trim()) {
		return process.env.PUBLIC_APP_BUILD_ID.trim();
	}
	try {
		return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
	} catch {
		return 'dev';
	}
}

const id = resolveBuildId();
const builtAt = new Date().toISOString();
const payload = { id, builtAt };

writeFileSync('static/build-id.json', `${JSON.stringify(payload, null, 2)}\n`);
console.log('[write-build-id]', id, builtAt);
