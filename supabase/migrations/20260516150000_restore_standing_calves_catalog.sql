-- Вернуть «Икры стоя» в каталог; «Разведение ног» остаётся отдельным пресетом.

update public.exercises
set hidden = false,
    sort_order = 7
where id = '11111111-1111-4111-8111-111111010025'::uuid;

update public.exercises
set sort_order = 5
where id = '11111111-1111-4111-8111-111111010043'::uuid;
