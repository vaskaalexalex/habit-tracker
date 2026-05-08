<script lang="ts">
	import BackButton from '$components/BackButton.svelte';
	import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '$supabase/types';

	const CATALOG: Record<MuscleGroup, readonly string[]> = {
		chest: ['Жим гантелей лёжа', 'Жим в тренажёре', 'Бабочка (тренажёр)', 'Бабочка (гантели)'],
		back: ['Тяга нижнего блока', 'Тяга верхнего блока', 'Подтягивания'],
		legs: ['Болгарские выпады', 'Гакк-приседания', 'Разгибание ног', 'Сгибание ног сидя', 'Икры стоя'],
		arms: [
			'Махи в стороны',
			'Жим плечами в тренажере',
			'Жим гантелей сидя',
			'Бицепс с гантелями',
			'Скамья Скотта',
			'Французский жим',
			'Трицепс вниз',
			'Задняя дельта'
		],
		core: ['Скручивания', 'Гиперэкстензия'],
		other: []
	};

	const SECTION_ORDER = [
		'chest',
		'back',
		'legs',
		'arms',
		'core'
	] as const satisfies readonly MuscleGroup[];
</script>

<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 sm:pt-10">
	<header class="flex items-center gap-2">
		<BackButton fallback="/sport/strength" />
		<div class="min-w-0 flex-1">
			<p class="text-xs font-bold uppercase tracking-wider text-(--color-accent)">Библиотека</p>
			<h1 class="mt-0.5 text-2xl font-black tracking-tight">Каталог упражнений</h1>
		</div>
	</header>

	<p class="text-sm leading-relaxed text-(--color-fg-mute)">
		Список зафиксирован в базе: 22 упражнения. Свои названия добавить нельзя — только выбор из каталога на
		экране силовой.
	</p>

	{#each SECTION_ORDER as group (group)}
		<section class="hairline rounded-2xl bg-(--color-bg-soft) p-3">
			<h2 class="mb-2 text-sm font-semibold text-(--color-fg)">{MUSCLE_GROUP_LABELS[group]}</h2>
			<ol class="list-decimal space-y-1 pl-5 text-sm">
				{#each CATALOG[group] as name (name)}
					<li>{name}</li>
				{/each}
			</ol>
		</section>
	{/each}

	<p class="text-xs text-(--color-fg-mute)">
		В пресетном каталоге нет упражнений в группе «{MUSCLE_GROUP_LABELS.other}» — пустую строку для неё всё
		равно можно добавить на экране силовой.
	</p>
</div>
