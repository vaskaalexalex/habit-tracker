# Supabase

Папка содержит миграции для развёртывания схемы трекера привычек.

## Файлы

- `migrations/20260430120000_init_schema.sql` — таблицы, индексы, типы, триггер `updated_at`.
- `migrations/20260430120100_rls.sql` — политики Row Level Security (`auth.uid() = user_id`).
- `migrations/20260430120200_seed_exercises.sql` — пресетные упражнения (`user_id = null`, `is_preset = true`).

## Накатить

### Вариант A. Supabase CLI (рекомендуется)

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### Вариант B. Вручную через SQL Editor

Открой `https://app.supabase.com/project/<ref>/sql` и выполни файлы по порядку:

1. `20260430120000_init_schema.sql`
2. `20260430120100_rls.sql`
3. `20260430120200_seed_exercises.sql`

## Настройка Auth (magic link)

`Authentication → Providers → Email` → включи `Enable Email provider`. Дополнительно:

- `Authentication → URL Configuration` → `Site URL` = твой прод-домен (или `http://localhost:5173` для дева).
- `Redirect URLs` добавь `http://localhost:5173/auth/callback` и продовый аналог.
