# Supabase

Папка содержит миграции для развёртывания схемы трекера привычек.

## Файлы

- `migrations/20260430120000_init_schema.sql` — таблицы, индексы, типы, триггер `updated_at`.
- `migrations/20260430120100_rls.sql` — политики Row Level Security (`auth.uid() = user_id`).
- `migrations/20260430120200_seed_exercises.sql` — начальный набор пресетов (исторический шаг миграций).
- `migrations/20260430160000_expand_preset_exercises.sql` — расширение пресетов (исторический).
- `migrations/20260508120000_preset_catalog_v2.sql` — **актуальный** каталог: 19 пресетов, `sort_order`, перенос `workout_sets`, удаление старых пресетов не из списка.
- `migrations/20260509120000_purge_removed_catalog_exercises.sql` — удаляет из БД все строки с отменёнными именами (в т.ч. пользовательские дубликаты) и связанные подходы; чистит «хвосты» не из финального каталога.

## Накатить

### Вариант A. Supabase CLI (рекомендуется)

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Накатывает все файлы из `migrations/` по порядку, включая финальный каталог пресетов.

### Вариант B. Вручную через SQL Editor

Открой `https://app.supabase.com/project/<ref>/sql` и выполни **все** SQL из `migrations/` по имени (хронологически), либо только недостающие после последнего деплоя — минимум накати `20260508120000_preset_catalog_v2.sql`, если остальная схема уже есть.

## Настройка Auth (magic link)

`Authentication → Providers → Email` → включи `Enable Email provider`. Дополнительно:

- `Authentication → URL Configuration` → `Site URL` = твой прод-домен (или `http://localhost:5173` для дева).
- `Redirect URLs` добавь `http://localhost:5173/auth/callback` и продовый аналог.
