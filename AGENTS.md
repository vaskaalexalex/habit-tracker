# AGENTS.md

## Cursor Cloud specific instructions

### Services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Vite dev server | `pnpm dev` | 5173 | Main SPA dev server |

### Quick reference

- **Lint**: `pnpm lint` (prettier + eslint); note: the repo has pre-existing formatting issues
- **Type check**: `pnpm check` (svelte-kit sync + svelte-check)
- **Build**: `pnpm build` (Vite production build → `build/`)
- **Dev server**: `pnpm dev` (localhost:5173)

### Gotchas

- `pnpm install` requires `pnpm.onlyBuiltDependencies: ["esbuild"]` in `package.json` for non-interactive environments. Without this, pnpm will block waiting for interactive approval of esbuild's postinstall script.
- The app requires `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` in `.env` to authenticate. Without real Supabase credentials, the app loads the login page but cannot complete authentication — all protected routes redirect to `/login`.
- The `.env` file is not committed; copy `.env.example` to `.env` and fill in credentials.
- The existing codebase has 2 pre-existing ESLint errors (in `ExerciseDropdown.svelte` and `push-sw.js`) and formatting issues flagged by Prettier. These are not regressions.
- `svelte-kit sync` must run before `svelte-check` (the `pnpm check` script handles this automatically).
- The `prepare` script runs `svelte-kit sync` on install, generating `.svelte-kit/` types.
