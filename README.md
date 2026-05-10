# Habit Tracker PWA

Progressive web app для отслеживания четырёх привычек: **Спорт → Кодинг → Чтение → Дневник**. Свой backend на Supabase, offline-first через Dexie + sync queue, деплоится на Cloudflare Pages.

## Стек

- **SvelteKit 2 + Svelte 5** (runes: `$state`, `$derived`, `$effect`)
- **TypeScript strict**
- **Tailwind CSS 4** (через `@tailwindcss/vite`)
- **@sveltejs/adapter-static** (SPA-режим, `200.html` fallback)
- **@supabase/supabase-js** — Auth (magic link) + Postgres + RLS
- **Dexie** — IndexedDB кеш + sync_queue (offline-first)
- **@vite-pwa/sveltekit** — manifest, service worker (Workbox), install prompt
- **lucide-svelte**, **date-fns**, **@fontsource-variable/inter**
- **pnpm**

## Структура

```
.
├── supabase/
│   ├── README.md
│   └── migrations/
│       ├── 20260430120000_init_schema.sql
│       ├── 20260430120100_rls.sql
│       └── 20260430120200_seed_exercises.sql
├── src/
│   ├── app.html, app.css, hooks.client.ts
│   ├── lib/
│   │   ├── supabase/      (client.ts, types.ts, api.ts)
│   │   ├── db/            (dexie.ts, sync.ts)
│   │   ├── stores/        (auth, habits, strength, cardio, journal, theme, toast — все на runes)
│   │   ├── components/    (HabitCard, HabitHeatmap, BottomNav, ExerciseDropdown, SetRow, WorkoutLog, JournalEditor, ProgressChart, ToastHost, InstallPrompt)
│   │   ├── utils/         (dates, uuid, strength)
│   │   └── bootstrap.ts
│   └── routes/
│       ├── +layout.svelte/+layout.ts
│       ├── +page.svelte                    (главная: 4 карточки + heatmap + month chart)
│       ├── login/+page.svelte              (magic link)
│       ├── auth/callback/+page.svelte
│       ├── profile/+page.svelte
│       ├── sport/+page.svelte              (хаб: силовая | другая)
│       ├── sport/strength/+page.svelte
│       ├── sport/strength/exercises/+page.svelte
│       ├── sport/cardio/+page.svelte
│       ├── journal/+page.svelte
│       └── journal/[date]/+page.svelte
└── static/
    ├── manifest.webmanifest (генерится vite-pwa)
    ├── icons/{192,512,maskable}.svg
    ├── favicon.svg
    └── _redirects (CF Pages SPA fallback)
```

## Локальный запуск

### 1. Установка

```bash
pnpm install
```

### 2. Настройка Supabase

1. Создай новый проект на [supabase.com](https://supabase.com) (free tier).
2. В разделе **SQL Editor** выполни по очереди:
   - `supabase/migrations/20260430120000_init_schema.sql`
   - `supabase/migrations/20260430120100_rls.sql`
   - `supabase/migrations/20260430120200_seed_exercises.sql`

   Или через Supabase CLI:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

3. **Authentication → Providers → Email**: включи `Email`, опционально отключи `Confirm email` для удобства разработки.
4. **Authentication → URL Configuration**:
   - `Site URL`: `http://localhost:5173`
   - `Redirect URLs`: добавь `http://localhost:5173/auth/callback` и продовый домен.
5. Скопируй из `Project Settings → API`:
   - `Project URL` → `PUBLIC_SUPABASE_URL`
   - `anon public` key → `PUBLIC_SUPABASE_ANON_KEY`

### 3. Env vars

Скопируй пример и заполни:

```bash
cp .env.example .env
```

```env
PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### 4. Запуск dev

```bash
pnpm dev
```

Откроется `http://localhost:5173`. Введи свой email — получишь magic link.

### 5. Production preview

```bash
pnpm build
pnpm preview
```

## Команды

| Команда        | Что делает                            |
| -------------- | ------------------------------------- |
| `pnpm dev`     | dev-сервер на `localhost:5173`        |
| `pnpm build`   | production-сборка в `build/`          |
| `pnpm preview` | локальный preview production-сборки   |
| `pnpm check`   | `svelte-check` (type-checking + a11y) |
| `pnpm lint`    | prettier + eslint                     |
| `pnpm format`  | автоформатирование prettier           |

## Деплой на Cloudflare Pages

1. Запушь репозиторий на GitHub.
2. На [Cloudflare Pages](https://pages.cloudflare.com) → **Create project** → подключи GitHub → выбери репо.
3. **Build settings**:
   - Framework preset: `SvelteKit`
   - Build command: `pnpm build`
   - Build output directory: `build`
   - Root directory: `/`
   - Install command: `pnpm install`
   - Node version: `21` (или выше)
4. **Environment variables (Production + Preview)**:
   - `PUBLIC_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `PUBLIC_SUPABASE_ANON_KEY` = `<anon-key>`
   - `PUBLIC_VAPID_PUBLIC_KEY` = публичный ключ из пары VAPID (`npx web-push generate-vapid-keys`); должен совпадать с публичным ключом на стороне Edge / Vault для push-напоминаний
5. **Deploy**. После первого деплоя добавь продовый домен в Supabase → `Authentication → URL Configuration → Redirect URLs`.

> CF Pages автоматически использует `static/_redirects` для SPA-фолбэка на `/200.html`.

## Деплой на GitHub Pages (этот репозиторий)

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) на шаге **Build** ожидает секреты репозитория:

| Secret | Назначение |
|--------|------------|
| `PUBLIC_SUPABASE_URL` | URL проекта Supabase |
| `PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `PUBLIC_VAPID_PUBLIC_KEY` | (опционально) публичный VAPID; если не задан, в клиенте используется значение из `src/lib/push/default-vapid-public.ts` |

После ротации ключей Web Push обнови секрет и при необходимости файл `default-vapid-public.ts`, а также приватный ключ на Edge / в Vault.

## Архитектура: optimistic UI + offline sync

Все мутации (галочка привычки, новый подход, запись в дневнике) идут через **optimistic write**:

```
User action
   │
   ▼
┌──────────────┐    ┌──────────────────┐    ┌────────────────────┐
│ store.add()  │ ─► │  Dexie .put()    │ ─► │ enqueue sync_queue │
│ (rune $state)│    │  (instant render)│    │ (op + payload + ts)│
└──────────────┘    └──────────────────┘    └─────────┬──────────┘
                                                       │
                                                online │ + интервал 30s
                                                       ▼
                                              ┌────────────────┐
                                              │ supabase upsert│
                                              │ retry/backoff  │
                                              └────────────────┘
```

- `lib/stores/*.svelte.ts` — runes-сторы, source of truth для UI.
- `lib/db/dexie.ts` — кеш + `sync_queue` таблица.
- `lib/db/sync.ts` — `enqueue()` + `drainQueue()` + watchers (`online` event + `setInterval(30_000)`).
- При офлайне всё пишется локально, очередь дренится при возвращении сети.
- Конфликт-резолв: last-write-wins по `updated_at`/`created_at`.

## Auto-completion привычек

- `Спорт`: помечается выполненным при первом подходе/кардио за день (`stores/auto-complete.ts → ensureSportCompleted`).
- `Дневник`: при первой записи/моду в дневнике (`ensureJournalCompleted`).
- `Кодинг` / `Чтение`: ручной toggle на главной карточке.

## Дизайн

- Тёмная тема по умолчанию + светлая (переключение на `/profile`).
- Inter Variable, шрифт-токены OKLCH.
- `glass` BottomNav, `safe-area-inset` для iOS notch.
- Тач-таргеты ≥44px, spring-анимации (svelte/motion), crossfade переходы.
- Все элементы рассчитаны на мобильный экран (max-width xl, центровка).

## Что осталось сделать вручную

1. **Создать проект Supabase** и накатить три миграции из `supabase/migrations/`.
2. **Прописать env vars** в `.env` (локально) и на CF Pages (для прода).
3. **Залить на GitHub** и подключить CF Pages.
4. **Установить PWA** на телефоне через "Добавить на главный экран" в Safari/Chrome.
5. (Опционально) Поменять SVG-иконки в `static/icons/` на финальные PNG/SVG бренда.
