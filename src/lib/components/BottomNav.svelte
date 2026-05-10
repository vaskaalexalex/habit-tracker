<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { isSamePathname } from '$lib/nav/same-pathname';
	import { Home, Dumbbell, BookOpenText, User } from 'lucide-svelte';
	import { syncStatusStore } from '$stores/sync-status.svelte';

	let navEl: HTMLElement | undefined = $state(undefined);

	onMount(() => {
		const el = navEl;
		if (!el || typeof ResizeObserver === 'undefined') return;

		function setOuterHeightPx(h: number) {
			document.documentElement.style.setProperty('--bottom-nav-outer-height', `${h}px`);
		}

		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const box = entry.borderBoxSize?.[0];
				const h = box ? box.blockSize : entry.contentRect.height;
				setOuterHeightPx(h);
			}
		});
		ro.observe(el);
		setOuterHeightPx(el.getBoundingClientRect().height);

		return () => {
			ro.disconnect();
			document.documentElement.style.removeProperty('--bottom-nav-outer-height');
		};
	});

	const profileHref = `${base}/profile`;

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
			href: profileHref,
			label: 'Профиль',
			icon: User,
			match: (p: string) => p.startsWith(`${base}/profile`)
		}
	]);

	function navigate(event: MouseEvent, href: string) {
		event.preventDefault();
		if (isSamePathname($page.url.pathname, href)) return;
		void goto(href);
	}
</script>

<nav
	bind:this={navEl}
	class="app-bottom-nav-vt bottom-nav-surface fixed inset-x-0 bottom-0 z-30 mx-auto max-w-xl border-t border-(--color-border) px-3 pt-2 sm:rounded-t-3xl"
	style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));"
	aria-label="Основная навигация"
>
	<ul class="grid grid-cols-4 gap-1">
		{#each items as item (item.href)}
			{@const active = item.match($page.url.pathname)}
			<li class="contents">
				<a
					href={item.href}
					onclick={(event) => navigate(event, item.href)}
					data-sveltekit-preload-data="hover"
					class="tap-target flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-xs transition active:scale-95"
					class:text-fg={active}
					class:text-fg-mute={!active}
					aria-current={active ? 'page' : undefined}
				>
					<span
						class="relative grid size-9 place-items-center rounded-xl transition"
						class:bg-accent-soft={active}
					>
						{#if item.href === profileHref}
							<span
								class="absolute -right-px -top-px z-[1] size-2 rounded-full ring-2 ring-(--color-bottom-nav-surface)"
								class:bg-rose-500={syncStatusStore.syncTier === 'red'}
								class:bg-amber-400={syncStatusStore.syncTier === 'yellow'}
								class:bg-emerald-500={syncStatusStore.syncTier === 'green'}
								role="img"
								title={syncStatusStore.syncTier === 'red'
									? 'Оффлайн — отправка в облако недоступна'
									: syncStatusStore.syncTier === 'yellow'
										? 'Синхронизация с сервером…'
										: 'Синхронизировано с сервером'}
								aria-label={syncStatusStore.syncTier === 'red'
									? 'Статус: оффлайн'
									: syncStatusStore.syncTier === 'yellow'
										? 'Статус: идёт синхронизация'
										: 'Статус: всё синхронизировано'}
							></span>
						{/if}
						<item.icon size={20} strokeWidth={active ? 2.4 : 1.8} />
					</span>
					<span class="text-[10px] font-bold uppercase tracking-wide sm:text-[11px]"
						>{item.label}</span
					>
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
