-- Fix calf exercises leaking into wrong groups; enforce catalog preset groups at DB level.

-- 1) Normalize legacy muscle_group typos / deprecated values
update public.exercises
set muscle_group = 'arms'
where muscle_group = 'shoulders';

update public.exercises
set muscle_group = lower(trim(muscle_group))
where muscle_group is not null
  and muscle_group <> lower(trim(muscle_group));

update public.exercises
set muscle_group = 'other'
where muscle_group is not null
  and muscle_group not in ('chest', 'back', 'legs', 'arms', 'core', 'other');

-- 2) Calf exercises always legs (wrong picker / corrupt rows)
update public.exercises
set muscle_group = 'legs'
where lower(trim(name)) like '%икр%'
  and muscle_group is distinct from 'legs';

-- 3) Canonical groups for built-in catalog UUIDs (belt if something drifted)
update public.exercises
set muscle_group = case id
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
end
where id in (
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
  '11111111-1111-4111-8111-111111010037'::uuid
);

-- 4) Trigger: catalog IDs always keep canonical group; calf names always legs
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
    '11111111-1111-4111-8111-111111010037'::uuid
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
    end;
    return new;
  end if;

  if lower(trim(new.name)) like '%икр%' then
    new.muscle_group := 'legs';
  end if;

  return new;
end;
$$;

drop trigger if exists exercises_enforce_muscle_group_trigger on public.exercises;

create trigger exercises_enforce_muscle_group_trigger
before insert or update
on public.exercises
for each row
execute function public.exercises_enforce_muscle_group();

-- 5) Allowed values only (nullable for backward compatibility with odd clients)
alter table public.exercises
drop constraint if exists exercises_muscle_group_check;

alter table public.exercises
add constraint exercises_muscle_group_check
check (
  muscle_group is null
  or muscle_group in ('chest', 'back', 'legs', 'arms', 'core', 'other')
);
