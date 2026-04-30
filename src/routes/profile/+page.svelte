<script lang="ts">
	import { authStore } from '$stores/auth.svelte';
	import { themeStore } from '$stores/theme.svelte';
	import { profileStore } from '$stores/profile.svelte';
	import { toasts } from '$stores/toast.svelte';
	import { LogOut, Sun, Moon, Github } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let localName = $state(profileStore.name);

	$effect(() => {
		localName = profileStore.name;
	});

	function save() {
		const next = localName.trim();
		if (next === profileStore.name) return;
		profileStore.setName(next);
		toasts.push('Сохранено');
	}

	async function logout() {
		await authStore.signOut();
		toasts.push('Вы вышли');
		void goto(`${base}/login`, { replaceState: true });
	}
</script>

<div class="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 sm:pt-10">
	<header>
		<h1 class="text-2xl font-semibold tracking-tight">Профиль</h1>
		<p class="mt-1 text-sm text-(--color-fg-mute)">{authStore.user?.email ?? '—'}</p>
	</header>

	<section class="hairline rounded-3xl bg-(--color-bg-soft) p-4">
		<label class="flex flex-col gap-2">
			<span class="text-xs font-medium uppercase tracking-wide text-(--color-fg-mute)">Имя</span>
			<input
				type="text"
				bind:value={localName}
				onblur={save}
				placeholder="Как тебя звать?"
				maxlength="40"
				class="hairline rounded-2xl bg-(--color-bg-mute) px-3 py-2.5 text-base outline-none placeholder:text-(--color-fg-mute)"
			/>
		</label>
	</section>

	<section class="hairline rounded-3xl bg-(--color-bg-soft) p-2">
		<button
			type="button"
			onclick={() => themeStore.toggle()}
			class="tap-target flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left active:scale-[0.99]"
		>
			<span class="flex items-center gap-3">
				<span class="grid size-9 place-items-center rounded-xl bg-(--color-bg-mute)">
					{#if themeStore.theme === 'dark'}
						<Moon size={18} />
					{:else}
						<Sun size={18} />
					{/if}
				</span>
				<span>Тема: {themeStore.theme === 'dark' ? 'тёмная' : 'светлая'}</span>
			</span>
			<span class="text-(--color-fg-mute) text-sm">переключить</span>
		</button>

		<a
			href="https://github.com"
			rel="noopener noreferrer"
			target="_blank"
			class="tap-target flex items-center gap-3 rounded-2xl px-3 py-3 active:scale-[0.99]"
		>
			<span class="grid size-9 place-items-center rounded-xl bg-(--color-bg-mute)">
				<Github size={18} />
			</span>
			<span>Исходники</span>
		</a>

		<button
			type="button"
			onclick={logout}
			class="tap-target flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-rose-400 active:scale-[0.99]"
		>
			<span class="grid size-9 place-items-center rounded-xl bg-rose-500/15">
				<LogOut size={18} />
			</span>
			<span>Выйти</span>
		</button>
	</section>
</div>
