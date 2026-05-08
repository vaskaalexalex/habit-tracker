-- Preset catalog v2: fixed sort_order, 19 presets, shoulders merged into arms for UI (DB may still have legacy rows until migrated).

alter table public.exercises
  add column if not exists sort_order smallint;

alter table public.exercises
  add column if not exists legacy_name text;

-- Preserve names for remapping; temporary unique names for old preset rows (only rows without catalog sort_order)
update public.exercises
set legacy_name = name
where is_preset
  and legacy_name is null
  and sort_order is null;

update public.exercises
set name = id::text
where is_preset
  and legacy_name is not null
  and sort_order is null;

-- Fixed preset IDs (UUID v4-form) for idempotent inserts
insert into public.exercises (id, user_id, name, muscle_group, is_preset, hidden, sort_order, legacy_name)
values
  ('11111111-1111-4111-8111-111111010001'::uuid, null, 'Жим гантелей лёжа', 'chest', true, false, 1, null),
  ('11111111-1111-4111-8111-111111010002'::uuid, null, 'Жим в тренажёре', 'chest', true, false, 2, null),
  ('11111111-1111-4111-8111-111111010003'::uuid, null, 'Бабочка (тренажёр)', 'chest', true, false, 3, null),
  ('11111111-1111-4111-8111-111111010004'::uuid, null, 'Бабочка (гантели)', 'chest', true, false, 4, null),

  ('11111111-1111-4111-8111-111111010011'::uuid, null, 'Тяга нижнего блока', 'back', true, false, 1, null),
  ('11111111-1111-4111-8111-111111010012'::uuid, null, 'Тяга верхнего блока', 'back', true, false, 2, null),
  ('11111111-1111-4111-8111-111111010013'::uuid, null, 'Подтягивания', 'back', true, false, 3, null),

  ('11111111-1111-4111-8111-111111010021'::uuid, null, 'Болгарские выпады', 'legs', true, false, 1, null),
  ('11111111-1111-4111-8111-111111010022'::uuid, null, 'Гакк-приседания', 'legs', true, false, 2, null),
  ('11111111-1111-4111-8111-111111010023'::uuid, null, 'Разгибание ног', 'legs', true, false, 3, null),
  ('11111111-1111-4111-8111-111111010024'::uuid, null, 'Сгибание ног сидя', 'legs', true, false, 4, null),
  ('11111111-1111-4111-8111-111111010025'::uuid, null, 'Икры стоя', 'legs', true, false, 5, null),

  ('11111111-1111-4111-8111-111111010031'::uuid, null, 'Махи в стороны', 'arms', true, false, 1, null),
  ('11111111-1111-4111-8111-111111010032'::uuid, null, 'Жим плечами в тренажере', 'arms', true, false, 2, null),
  ('11111111-1111-4111-8111-111111010033'::uuid, null, 'Жим гантелей сидя', 'arms', true, false, 3, null),
  ('11111111-1111-4111-8111-111111010034'::uuid, null, 'Бицепс с гантелями', 'arms', true, false, 4, null),
  ('11111111-1111-4111-8111-111111010035'::uuid, null, 'Скамья Скотта', 'arms', true, false, 5, null),
  ('11111111-1111-4111-8111-111111010036'::uuid, null, 'Французский жим', 'arms', true, false, 6, null),
  ('11111111-1111-4111-8111-111111010037'::uuid, null, 'Трицепс вниз', 'arms', true, false, 7, null)
on conflict (id) do update set
  name = excluded.name,
  muscle_group = excluded.muscle_group,
  is_preset = excluded.is_preset,
  hidden = excluded.hidden,
  sort_order = excluded.sort_order,
  legacy_name = excluded.legacy_name;

-- Remap workout_sets: exact name + group match (legacy muscle_group normalized)
update public.workout_sets ws
set exercise_id = n.id
from public.exercises o
join public.exercises n
  on n.sort_order is not null
  and n.is_preset
  and n.user_id is null
  and lower(trim(o.legacy_name)) = lower(trim(n.name))
  and (
    case
      when o.muscle_group = 'shoulders' then 'arms'
      else coalesce(o.muscle_group, '')
    end
  ) = coalesce(n.muscle_group, '')
where ws.exercise_id = o.id
  and o.legacy_name is not null;

-- Name aliases (old seed name -> same new preset)
update public.workout_sets ws
set exercise_id = n.id
from public.exercises o
join public.exercises n
  on n.id = '11111111-1111-4111-8111-111111010035'::uuid
where ws.exercise_id = o.id
  and o.legacy_name is not null
  and lower(trim(o.legacy_name)) in ('скотта', 'скамья скотта')
  and (
    case when o.muscle_group = 'shoulders' then 'arms' else coalesce(o.muscle_group, '') end
  ) = 'arms';

update public.workout_sets ws
set exercise_id = n.id
from public.exercises o
join public.exercises n
  on n.id = '11111111-1111-4111-8111-111111010037'::uuid
where ws.exercise_id = o.id
  and o.legacy_name is not null
  and lower(trim(o.legacy_name)) in ('разгибания на блоке', 'трицепс вниз')
  and (
    case when o.muscle_group = 'shoulders' then 'arms' else coalesce(o.muscle_group, '') end
  ) = 'arms';

-- Fallback: first preset in group by sort_order
update public.workout_sets ws
set exercise_id = sub.new_id
from (
  select
    ws2.id as set_row_id,
    (
      select n.id
      from public.exercises n
      where n.is_preset
        and n.sort_order is not null
        and n.muscle_group = case
          when o.muscle_group = 'shoulders' then 'arms'
          when o.muscle_group in ('core', 'other') then 'arms'
          else o.muscle_group
        end
      order by n.sort_order
      limit 1
    ) as new_id
  from public.workout_sets ws2
  join public.exercises o on o.id = ws2.exercise_id
  where o.legacy_name is not null
) sub
where ws.id = sub.set_row_id
  and sub.new_id is not null;

-- Delete obsolete preset rows (had legacy_name)
delete from public.exercises
where legacy_name is not null;

alter table public.exercises
  drop column if exists legacy_name;

-- User-created rows may still reference shoulders in muscle_group; consolidate
update public.exercises
set muscle_group = 'arms'
where muscle_group = 'shoulders';

-- Clear sort_order for non-presets
update public.exercises
set sort_order = null
where not is_preset;
