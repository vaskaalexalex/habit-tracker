insert into public.exercises (id, user_id, name, muscle_group, is_preset)
values
  (gen_random_uuid(), null, 'Жим гантелей лёжа', 'chest', true),
  (gen_random_uuid(), null, 'Жим в тренажёре', 'chest', true),
  (gen_random_uuid(), null, 'Сведения в кроссовере', 'chest', true),
  (gen_random_uuid(), null, 'Отжимания', 'chest', true),
  (gen_random_uuid(), null, 'Бабочка (тренажёр)', 'chest', true),

  (gen_random_uuid(), null, 'Тяга гантели одной рукой', 'back', true),
  (gen_random_uuid(), null, 'Тяга нижнего блока', 'back', true),
  (gen_random_uuid(), null, 'Гиперэкстензия', 'back', true),
  (gen_random_uuid(), null, 'Шраги', 'back', true),
  (gen_random_uuid(), null, 'Подтягивания обратным хватом', 'back', true),

  (gen_random_uuid(), null, 'Сгибание ног лёжа', 'legs', true),
  (gen_random_uuid(), null, 'Сгибание ног сидя', 'legs', true),
  (gen_random_uuid(), null, 'Разгибание ног', 'legs', true),
  (gen_random_uuid(), null, 'Икры стоя', 'legs', true),
  (gen_random_uuid(), null, 'Икры сидя', 'legs', true),
  (gen_random_uuid(), null, 'Болгарские выпады', 'legs', true),
  (gen_random_uuid(), null, 'Гакк-приседания', 'legs', true),
  (gen_random_uuid(), null, 'Зашагивания на тумбу', 'legs', true),

  (gen_random_uuid(), null, 'Бицепс с гантелями', 'arms', true),
  (gen_random_uuid(), null, 'Концентрированный подъём', 'arms', true),
  (gen_random_uuid(), null, 'Скотта', 'arms', true),
  (gen_random_uuid(), null, 'Разгибания на блоке', 'arms', true),
  (gen_random_uuid(), null, 'Разгибания над головой', 'arms', true),
  (gen_random_uuid(), null, 'Тяга штанги к подбородку', 'arms', true),
  (gen_random_uuid(), null, 'Махи назад в наклоне', 'arms', true),

  (gen_random_uuid(), null, 'Боковая планка', 'other', true),
  (gen_random_uuid(), null, 'Велосипед', 'other', true),
  (gen_random_uuid(), null, 'Подъём ног в висе', 'other', true),
  (gen_random_uuid(), null, 'Русские скручивания', 'other', true)
on conflict do nothing;
