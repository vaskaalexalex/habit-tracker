<script lang="ts">
	import PageHeader from '$components/PageHeader.svelte';
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
		core: ['Скручивания', 'Гиперэкстензия']
	};

	const SECTION_ORDER = [
		'chest',
		'back',
		'legs',
		'arms',
		'core'
	] as const satisfies readonly MuscleGroup[];
</script>

<div class="page-shell">
	<PageHeader
		kicker="Библиотека"
		title="Каталог упражнений"
		subtitle="Список зафиксирован в базе: 22 упражнения."
		meta="Свои названия добавить нельзя — только выбор из каталога на экране силовой."
	/>

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
</div>
