-- Каталог v3: +1 arms (Задняя дельта), +2 core (Скручивания, Гиперэкстензия) → 22 пресета.

insert into public.exercises (id, user_id, name, muscle_group, is_preset, hidden, sort_order)
values
  ('11111111-1111-4111-8111-111111010038'::uuid, null, 'Задняя дельта', 'arms', true, false, 8),
  ('11111111-1111-4111-8111-111111010039'::uuid, null, 'Скручивания', 'core', true, false, 1),
  ('11111111-1111-4111-8111-111111010040'::uuid, null, 'Гиперэкстензия', 'core', true, false, 2)
on conflict (id) do update set
  name = excluded.name,
  muscle_group = excluded.muscle_group,
  is_preset = excluded.is_preset,
  hidden = excluded.hidden,
  sort_order = excluded.sort_order;

create or replace function public.exercises_enforce_muscle_group()
returns trigger
language plpgsql
as $$
begin
  if new.id in (
    '11111111-1111-4111-8111-111111010001'::uuid,
    '11111111-1111-4111-8111-111111010002'::uuid,
    '11111111-1111-4111-8111-111111010003'::uuid,
    '11111111-1111-4111-8111-111111010004'::uuid,
    '11111111-1111-4111-8111-111111010011'::uuid,
    '11111111-1111-4111-8111-111111010012'::uuid,
    '11111111-1111-4111-8111-111111010013'::uuid,
    '11111111-1111-4111-8111-111111010021'::uuid,
    '11111111-1111-4111-8111-111111010022'::uuid,
    '11111111-1111-4111-8111-111111010023'::uuid,
    '11111111-1111-4111-8111-111111010024'::uuid,
    '11111111-1111-4111-8111-111111010025'::uuid,
    '11111111-1111-4111-8111-111111010031'::uuid,
    '11111111-1111-4111-8111-111111010032'::uuid,
    '11111111-1111-4111-8111-111111010033'::uuid,
    '11111111-1111-4111-8111-111111010034'::uuid,
    '11111111-1111-4111-8111-111111010035'::uuid,
    '11111111-1111-4111-8111-111111010036'::uuid,
    '11111111-1111-4111-8111-111111010037'::uuid,
    '11111111-1111-4111-8111-111111010038'::uuid,
    '11111111-1111-4111-8111-111111010039'::uuid,
    '11111111-1111-4111-8111-111111010040'::uuid
  ) then
    new.muscle_group := case new.id
      when '11111111-1111-4111-8111-111111010001'::uuid then 'chest'
      when '11111111-1111-4111-8111-111111010002'::uuid then 'chest'
      when '11111111-1111-4111-8111-111111010003'::uuid then 'chest'
      when '11111111-1111-4111-8111-111111010004'::uuid then 'chest'
      when '11111111-1111-4111-8111-111111010011'::uuid then 'back'
      when '11111111-1111-4111-8111-111111010012'::uuid then 'back'
      when '11111111-1111-4111-8111-111111010013'::uuid then 'back'
      when '11111111-1111-4111-8111-111111010021'::uuid then 'legs'
      when '11111111-1111-4111-8111-111111010022'::uuid then 'legs'
      when '11111111-1111-4111-8111-111111010023'::uuid then 'legs'
      when '11111111-1111-4111-8111-111111010024'::uuid then 'legs'
      when '11111111-1111-4111-8111-111111010025'::uuid then 'legs'
      when '11111111-1111-4111-8111-111111010031'::uuid then 'arms'
      when '11111111-1111-4111-8111-111111010032'::uuid then 'arms'
      when '11111111-1111-4111-8111-111111010033'::uuid then 'arms'
      when '11111111-1111-4111-8111-111111010034'::uuid then 'arms'
      when '11111111-1111-4111-8111-111111010035'::uuid then 'arms'
      when '11111111-1111-4111-8111-111111010036'::uuid then 'arms'
      when '11111111-1111-4111-8111-111111010037'::uuid then 'arms'
      when '11111111-1111-4111-8111-111111010038'::uuid then 'arms'
      when '11111111-1111-4111-8111-111111010039'::uuid then 'core'
      when '11111111-1111-4111-8111-111111010040'::uuid then 'core'
    end;
    return new;
  end if;

  if lower(trim(new.name)) like '%икр%' then
    new.muscle_group := 'legs';
  end if;

  return new;
end;
$$;

create or replace function public.exercises_reject_non_catalog_rows()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is not null then
    raise exception 'catalog_only: только пресеты каталога (user_id IS NULL), пользовательские строки запрещены';
  end if;
  return new;
end;
$$;
