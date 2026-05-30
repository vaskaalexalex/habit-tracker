# Supabase

Папка содержит миграции для развёртывания схемы трекера привычек.

## Файлы

- `migrations/20260430120000_init_schema.sql` — таблицы, индексы, типы, триггер `updated_at`.
- `migrations/20260430120100_rls.sql` — политики Row Level Security (`auth.uid() = user_id`).
- `migrations/20260430120200_seed_exercises.sql` — начальный набор пресетов (исторический шаг миграций).
- `migrations/20260430160000_expand_preset_exercises.sql` — расширение пресетов (исторический).
- `migrations/20260508120000_preset_catalog_v2.sql` — **актуальный** каталог: 19 пресетов, `sort_order`, перенос `workout_sets`, удаление старых пресетов не из списка.
- `migrations/20260509120000_purge_removed_catalog_exercises.sql` — удаляет из БД все строки с отменёнными именами (в т.ч. пользовательские дубликаты) и связанные подходы; чистит «хвосты» не из финального каталога.
- `migrations/20260510140000_exercises_muscle_group_enforcement.sql` — триггер фиксирует группу для пресетных UUID каталога; имена с «икр» → `legs`; `CHECK` на допустимые значения `muscle_group` (список UUID расширен в `20260513120000_catalog_rear_delt_core.sql`).
- `migrations/20260511120000_exercises_only_catalog_nineteen.sql` — в таблице остаются только 19 строк каталога; удалены все пользовательские упражнения и подходы к ним; триггер запрещает `INSERT` с `user_id IS NOT NULL`.
- `migrations/20260512120000_rename_upper_block_pull.sql` — спина №2 в каталоге: название «Тяга верхнего блока».
- `migrations/20260513120000_catalog_rear_delt_core.sql` — каталог **22** пресета: `arms` +«Задняя дельта», `core` +«Скручивания», «Гиперэкстензия»; обновление `exercises_enforce_muscle_group`; текст исключения `catalog_only` без привязки к числу 19.
- `migrations/20260523120000_user_profiles.sql` — таблица `user_profiles` (отображаемое имя) + RLS + триггер `updated_at`.
- `migrations/20260530120000_tasks.sql` — доска задач: `task_lists` → `tasks` → `task_subtasks`, enum `task_status` / `task_priority`, RLS на владельца, триггер `tasks_touch_updated_at`.

## Демо-данные

[`seed-demo.sql`](seed-demo.sql) — идемпотентный сид: создаёт демо-пользователя (`demo@habit-tracker.app` / `habit-demo-2026`) и наполняет его привычками, тренировками, дневником и задачами. Повторный запуск сбрасывает данные демо-аккаунта к известному состоянию. Запуск: SQL Editor, `supabase db execute --file supabase/seed-demo.sql` или `psql "$DATABASE_URL" -f supabase/seed-demo.sql`.

## Накатить

### Вариант A. Supabase CLI (рекомендуется)

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Накатывает все файлы из `migrations/` по порядку, включая финальный каталог пресетов.

### Вариант B. Вручную через SQL Editor

Открой `https://app.supabase.com/project/<ref>/sql` и выполни **все** SQL из `migrations/` по имени (хронологически), либо только недостающие после последнего деплоя — минимум накати `20260508120000_preset_catalog_v2.sql`, если остальная схема уже есть.

## Настройка Auth (email + пароль)

`Authentication → Providers → Email` → включи `Enable Email provider`. Приложение входит через `signInWithPassword` (email + пароль). Дополнительно:

- `Authentication → URL Configuration` → `Site URL` = твой прод-домен (или `http://localhost:5173` для дева).
- `Redirect URLs` добавь `http://localhost:5173` и продовый аналог.
- Для демо-аккаунта проще всего отключить подтверждение email (`Confirm email`) или использовать `seed-demo.sql`, который сразу проставляет `email_confirmed_at`.
