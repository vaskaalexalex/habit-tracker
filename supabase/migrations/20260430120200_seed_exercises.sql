insert into public.exercises (id, user_id, name, muscle_group, is_preset)
values
  (gen_random_uuid(), null, 'Жим лёжа', 'chest', true),
  (gen_random_uuid(), null, 'Жим под углом', 'chest', true),
  (gen_random_uuid(), null, 'Разводка гантелей', 'chest', true),
  (gen_random_uuid(), null, 'Приседания со штангой', 'legs', true),
  (gen_random_uuid(), null, 'Жим ногами', 'legs', true),
  (gen_random_uuid(), null, 'Румынская тяга', 'legs', true),
  (gen_random_uuid(), null, 'Выпады с гантелями', 'legs', true),
  (gen_random_uuid(), null, 'Становая тяга', 'back', true),
  (gen_random_uuid(), null, 'Подтягивания', 'back', true),
  (gen_random_uuid(), null, 'Тяга штанги в наклоне', 'back', true),
  (gen_random_uuid(), null, 'Тяга верхнего блока', 'back', true),
  (gen_random_uuid(), null, 'Армейский жим', 'shoulders', true),
  (gen_random_uuid(), null, 'Жим гантелей сидя', 'shoulders', true),
  (gen_random_uuid(), null, 'Махи в стороны', 'shoulders', true),
  (gen_random_uuid(), null, 'Подъём штанги на бицепс', 'arms', true),
  (gen_random_uuid(), null, 'Молотки', 'arms', true),
  (gen_random_uuid(), null, 'Французский жим', 'arms', true),
  (gen_random_uuid(), null, 'Отжимания на брусьях', 'arms', true),
  (gen_random_uuid(), null, 'Скручивания', 'core', true),
  (gen_random_uuid(), null, 'Планка', 'core', true)
on conflict do nothing;
