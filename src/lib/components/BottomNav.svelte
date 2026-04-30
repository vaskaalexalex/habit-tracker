<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { Home, Dumbbell, BookOpenText, User } from 'lucide-svelte';

	const items = $derived([
		{
			href: `${base}/`,
			label: 'Главная',
			icon: Home,
			match: (p: string) => p === `${base}/` || p === `${base}`
		},
		{
			href: `${base}/sport`,
			label: 'Спорт',
			icon: Dumbbell,
			match: (p: string) => p.startsWith(`${base}/sport`)
		},
		{
			href: `${base}/journal`,
			label: 'Дневник',
			icon: BookOpenText,
			match: (p: string) => p.startsWith(`${base}/journal`)
		},
		{
			href: `${base}/profile`,
			label: 'Профиль',
			icon: User,
			match: (p: string) => p.startsWith(`${base}/profile`)
		}
	]);
</script>

<nav
	class="glass safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-(--color-border) px-3 pt-2 sm:rounded-t-3xl"
	aria-label="Основная навигация"
>
	<ul class="grid grid-cols-4 gap-1">
		{#each items as item (item.href)}
			{@const active = item.match($page.url.pathname)}
			<li class="contents">
				<a
					href={item.href}
					data-sveltekit-preload-data="hover"
					class="tap-target flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-xs transition active:scale-95"
					class:text-fg={active}
					class:text-fg-mute={!active}
					aria-current={active ? 'page' : undefined}
				>
					<span
						class="grid size-9 place-items-center rounded-xl transition"
						class:bg-accent-soft={active}
					>
						<item.icon size={20} strokeWidth={active ? 2.4 : 1.8} />
					</span>
					<span class="font-medium">{item.label}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.text-fg {
		color: var(--color-fg);
	}
	.text-fg-mute {
		color: var(--color-fg-mute);
	}
	.bg-accent-soft {
		background: var(--color-accent-soft);
	}
</style>
