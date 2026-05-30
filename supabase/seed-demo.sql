-- =====================================================================
-- Habit Tracker — demo account + mock data seed (idempotent)
-- ---------------------------------------------------------------------
-- Creates a ready-to-explore demo user and fills it with realistic data
-- (habits, workouts, journal, tasks) so a reviewer can log in and click
-- around immediately.
--
-- Demo credentials:
--   email:    demo@habit-tracker.app
--   password: habit-demo-2026
--
-- How to run (pick one):
--   A) Supabase SQL Editor — paste this whole file and Run.
--   B) Supabase CLI        — supabase db execute --file supabase/seed-demo.sql
--   C) psql "$DATABASE_URL" -f supabase/seed-demo.sql
--
-- Re-running RESETS the demo user's app data to this known state
-- (the auth user itself is created once and then reused).
--
-- NOTE: Part A inserts into auth.* which is GoTrue-version sensitive.
-- If it errors on your Supabase version, create the user manually in the
-- Dashboard (Authentication -> Users -> Add user -> "Auto Confirm User")
-- with the same email/password — the rest of the script will pick it up
-- by email automatically.
-- =====================================================================

do $$
declare
  v_email      text := 'demo@habit-tracker.app';
  v_password   text := 'habit-demo-2026';
  v_uid        uuid;
  v_list_work  uuid := gen_random_uuid();
  v_list_life  uuid := gen_random_uuid();
  v_list_study uuid := gen_random_uuid();
  v_task       uuid;
begin
  ------------------------------------------------------------------
  -- Part A. Ensure the demo auth user exists.
  ------------------------------------------------------------------
  select id into v_uid from auth.users where email = v_email;

  if v_uid is null then
    v_uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')), now(),
      now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text, 'email',
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      now(), now(), now()
    );
  end if;

  ------------------------------------------------------------------
  -- Part B. Reset and reseed the demo user's app data.
  ------------------------------------------------------------------
  delete from public.tasks            where user_id = v_uid;  -- cascades task_subtasks
  delete from public.task_lists       where user_id = v_uid;
  delete from public.workout_sets     where user_id = v_uid;
  delete from public.cardio_workouts  where user_id = v_uid;
  delete from public.journal_entries  where user_id = v_uid;
  delete from public.habit_completions where user_id = v_uid;

  insert into public.user_profiles (id, display_name)
  values (v_uid, 'Demo · Гость')
  on conflict (id) do update set display_name = excluded.display_name;

  ------------------------------------------------------------------
  -- Habit completions (last 45 days) — drives the heatmap + month chart.
  ------------------------------------------------------------------
  -- Coding: weekdays
  insert into public.habit_completions (user_id, habit_type, date)
  select v_uid, 'coding', d::date
  from generate_series(current_date - 44, current_date, interval '1 day') g(d)
  where extract(dow from d) not in (0, 6)
  on conflict (user_id, habit_type, date) do nothing;

  -- Reading: every other day
  insert into public.habit_completions (user_id, habit_type, date)
  select v_uid, 'reading', d::date
  from generate_series(current_date - 44, current_date, interval '1 day') g(d)
  where (current_date - d::date) % 2 = 0
  on conflict (user_id, habit_type, date) do nothing;

  -- Sport: Mon / Wed / Fri (+ the explicit workout days below)
  insert into public.habit_completions (user_id, habit_type, date)
  select v_uid, 'sport', d::date
  from generate_series(current_date - 44, current_date, interval '1 day') g(d)
  where extract(dow from d) in (1, 3, 5)
  on conflict (user_id, habit_type, date) do nothing;

  insert into public.habit_completions (user_id, habit_type, date)
  select v_uid, 'sport', current_date - x
  from unnest(array[2, 5, 9, 3, 1, 7]) as x
  on conflict (user_id, habit_type, date) do nothing;

  -- Journal: the entries seeded below
  insert into public.habit_completions (user_id, habit_type, date)
  select v_uid, 'journal', current_date - x
  from unnest(array[0, 2, 4, 7, 10, 14]) as x
  on conflict (user_id, habit_type, date) do nothing;

  ------------------------------------------------------------------
  -- Strength workouts (referenced by preset name; presets come from migrations).
  ------------------------------------------------------------------
  insert into public.workout_sets (user_id, date, exercise_id, weight, reps, set_number)
  select v_uid, current_date - 2,
         (select id from public.exercises where lower(name) = lower('Жим гантелей лёжа') and is_preset limit 1),
         t.w, t.r, t.s
  from (values (22,12,1),(24,10,2),(24,9,3)) as t(w,r,s)
  where exists (select 1 from public.exercises where lower(name) = lower('Жим гантелей лёжа') and is_preset);

  insert into public.workout_sets (user_id, date, exercise_id, weight, reps, set_number)
  select v_uid, current_date - 2,
         (select id from public.exercises where lower(name) = lower('Тяга верхнего блока') and is_preset limit 1),
         t.w, t.r, t.s
  from (values (50,12,1),(55,10,2),(55,10,3)) as t(w,r,s)
  where exists (select 1 from public.exercises where lower(name) = lower('Тяга верхнего блока') and is_preset);

  insert into public.workout_sets (user_id, date, exercise_id, weight, reps, set_number)
  select v_uid, current_date - 5,
         (select id from public.exercises where lower(name) = lower('Гакк-приседания') and is_preset limit 1),
         t.w, t.r, t.s
  from (values (80,12,1),(90,10,2),(90,9,3)) as t(w,r,s)
  where exists (select 1 from public.exercises where lower(name) = lower('Гакк-приседания') and is_preset);

  insert into public.workout_sets (user_id, date, exercise_id, weight, reps, set_number)
  select v_uid, current_date - 9,
         (select id from public.exercises where lower(name) = lower('Бицепс с гантелями') and is_preset limit 1),
         t.w, t.r, t.s
  from (values (12,12,1),(14,10,2),(14,8,3)) as t(w,r,s)
  where exists (select 1 from public.exercises where lower(name) = lower('Бицепс с гантелями') and is_preset);

  ------------------------------------------------------------------
  -- Cardio.
  ------------------------------------------------------------------
  insert into public.cardio_workouts (user_id, date, type, duration_min, distance_km, note)
  values
    (v_uid, current_date - 3, 'run',  28, 5.20, 'Утренняя пробежка вдоль набережной'),
    (v_uid, current_date - 1, 'walk', 40, 3.50, NULL),
    (v_uid, current_date - 7, 'swim', 35, 1.50, 'Бассейн, кроль');

  ------------------------------------------------------------------
  -- Journal entries (mood 1..5).
  ------------------------------------------------------------------
  insert into public.journal_entries (user_id, date, content, mood) values
    (v_uid, current_date,      'Закрыл крупную задачу по синхронизации. Доволен прогрессом по проекту.', 5),
    (v_uid, current_date - 2,  'Тренировка далась тяжело, но настроение после неё отличное.', 4),
    (v_uid, current_date - 4,  'День без фокуса, много отвлекался. Завтра планирую заранее.', 3),
    (v_uid, current_date - 7,  'Прочитал главу про индексы в Postgres — наконец улеглось в голове.', 4),
    (v_uid, current_date - 10, 'Лёгкая простуда, отдыхал. Зато много читал.', 3),
    (v_uid, current_date - 14, 'Старт новой привычки — дневник. Посмотрим, как пойдёт.', 4)
  on conflict (user_id, date) do nothing;

  ------------------------------------------------------------------
  -- Task lists.
  ------------------------------------------------------------------
  insert into public.task_lists (id, user_id, name, sort_order) values
    (v_list_work,  v_uid, 'Работа',  1),
    (v_list_life,  v_uid, 'Личное',  2),
    (v_list_study, v_uid, 'Учёба',   3);

  ------------------------------------------------------------------
  -- Tasks + subtasks — deliberately spanning every UI state.
  ------------------------------------------------------------------

  -- Работа -------------------------------------------------------
  -- done, high, with full subtasks
  v_task := gen_random_uuid();
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (v_task, v_uid, v_list_work, 'Задеплоить habit-tracker на GitHub Pages',
          'CI собирает SPA и публикует артефакт.', 'done', 'high', NULL, 1);
  insert into public.task_subtasks (user_id, task_id, title, done, sort_order) values
    (v_uid, v_task, 'Настроить workflow', true, 1),
    (v_uid, v_task, 'Прописать секреты репозитория', true, 2),
    (v_uid, v_task, 'Проверить прод-сборку', true, 3);

  -- in_progress, medium, due TODAY (soon), partial subtasks
  v_task := gen_random_uuid();
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (v_task, v_uid, v_list_work, 'Code review PR #42',
          '', 'in_progress', 'medium', current_date, 2);
  insert into public.task_subtasks (user_id, task_id, title, done, sort_order) values
    (v_uid, v_task, 'Проверить логику синхронизации', true, 1),
    (v_uid, v_task, 'Прогнать линтер', false, 2),
    (v_uid, v_task, 'Оставить комментарии', false, 3);

  -- todo, high, future due
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (gen_random_uuid(), v_uid, v_list_work, 'Написать тесты для sync queue',
          'Покрыть offline drain + retry/backoff.', 'todo', 'high', current_date + 5, 3);

  -- in_progress, high, due TOMORROW (soon), partial subtasks
  v_task := gen_random_uuid();
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (v_task, v_uid, v_list_work, 'Обновить README проекта',
          'Стек, схема БД, живое демо.', 'in_progress', 'high', current_date + 1, 4);
  insert into public.task_subtasks (user_id, task_id, title, done, sort_order) values
    (v_uid, v_task, 'Описать стек', true, 1),
    (v_uid, v_task, 'Диаграмма архитектуры', true, 2),
    (v_uid, v_task, 'ER-схема БД', false, 3),
    (v_uid, v_task, 'Демо-доступ', false, 4);

  -- Личное -------------------------------------------------------
  -- todo, medium, OVERDUE
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (gen_random_uuid(), v_uid, v_list_life, 'Записаться к врачу',
          '', 'todo', 'medium', current_date - 2, 5);

  -- done, low, full subtasks
  v_task := gen_random_uuid();
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (v_task, v_uid, v_list_life, 'Купить продукты на неделю',
          '', 'done', 'low', NULL, 6);
  insert into public.task_subtasks (user_id, task_id, title, done, sort_order) values
    (v_uid, v_task, 'Овощи и фрукты', true, 1),
    (v_uid, v_task, 'Крупы', true, 2),
    (v_uid, v_task, 'Молочка', true, 3),
    (v_uid, v_task, 'Кофе', true, 4);

  -- todo, low, due today
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (gen_random_uuid(), v_uid, v_list_life, 'Позвонить родителям',
          '', 'todo', 'low', current_date, 7);

  -- Учёба --------------------------------------------------------
  -- in_progress, medium, future due, partial subtasks (2/5)
  v_task := gen_random_uuid();
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (v_task, v_uid, v_list_study, 'Глава 5: индексы в Postgres',
          'B-tree, частичные и покрывающие индексы.', 'in_progress', 'medium', current_date + 3, 8);
  insert into public.task_subtasks (user_id, task_id, title, done, sort_order) values
    (v_uid, v_task, 'Прочитать главу', true, 1),
    (v_uid, v_task, 'Законспектировать', true, 2),
    (v_uid, v_task, 'EXPLAIN ANALYZE на примере', false, 3),
    (v_uid, v_task, 'Частичный индекс', false, 4),
    (v_uid, v_task, 'Покрывающий индекс', false, 5);

  -- todo, high, no due
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (gen_random_uuid(), v_uid, v_list_study, 'Решить 3 задачи на LeetCode',
          '', 'todo', 'high', NULL, 9);

  -- in_progress, low, no due, partial subtasks
  v_task := gen_random_uuid();
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (v_task, v_uid, v_list_study, 'Досмотреть курс по Svelte 5 runes',
          '', 'in_progress', 'low', NULL, 10);
  insert into public.task_subtasks (user_id, task_id, title, done, sort_order) values
    (v_uid, v_task, '$state и $derived', true, 1),
    (v_uid, v_task, '$effect', false, 2),
    (v_uid, v_task, 'Сниппеты и пропсы', false, 3);

  -- done, medium, no due, no subtasks
  insert into public.tasks (id, user_id, list_id, title, notes, status, priority, due_date, sort_order)
  values (gen_random_uuid(), v_uid, v_list_study, 'Конспект по RLS в Supabase',
          '', 'done', 'medium', NULL, 11);

  raise notice 'Demo user % seeded (email %).', v_uid, v_email;
end $$;
