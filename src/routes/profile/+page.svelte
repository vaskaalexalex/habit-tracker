<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$stores/auth.svelte';
	import { themeStore } from '$stores/theme.svelte';
	import { profileStore } from '$stores/profile.svelte';
	import { toasts } from '$stores/toast.svelte';
	import { LogOut, Sun, Moon, Github, Clipboard, RefreshCw, Trash2 } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { clearSyncDebugLog, getSyncDebugLogText, syncDebug } from '$utils/sync-debug';

	let localName = $state(profileStore.name);
	let debugLog = $state('');

	$effect(() => {
		localName = profileStore.name;
	});

	onMount(() => {
		refreshDebugLog();
		const interval = window.setInterval(refreshDebugLog, 2_000);
		return () => window.clearInterval(interval);
	});

	function save() {
		const next = localName.trim();
		if (next === profileStore.name) return;
		profileStore.setName(next);
		toasts.push('Сохранено');
	}

	function refreshDebugLog() {
		debugLog = getSyncDebugLogText();
	}

	async function copyDebugLog() {
		refreshDebugLog();
		await navigator.clipboard.writeText(debugLog || 'Лог пуст');
		toasts.push('Лог скопирован');
	}

	function clearDebugLog() {
		clearSyncDebugLog();
		syncDebug('debug-profile-open');
		refreshDebugLog();
		toasts.push('Лог очищен');
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

	<section class="hairline rounded-3xl bg-(--color-bg-soft) p-4">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h2 class="font-medium">Sync debug log</h2>
				<p class="mt-1 text-xs text-(--color-fg-mute)">
					Открой PWA, дождись проблемы, потом скопируй лог сюда.
				</p>
			</div>
			<div class="flex shrink-0 gap-1">
				<button
					type="button"
					aria-label="Обновить лог"
					class="tap-target rounded-xl bg-(--color-bg-mute) p-2 active:scale-95"
					onclick={refreshDebugLog}
				>
					<RefreshCw size={16} />
				</button>
				<button
					type="button"
					aria-label="Скопировать лог"
					class="tap-target rounded-xl bg-(--color-accent) p-2 text-white active:scale-95"
					onclick={copyDebugLog}
				>
					<Clipboard size={16} />
				</button>
				<button
					type="button"
					aria-label="Очистить лог"
					class="tap-target rounded-xl bg-rose-500/15 p-2 text-rose-400 active:scale-95"
					onclick={clearDebugLog}
				>
					<Trash2 size={16} />
				</button>
			</div>
		</div>
		<textarea
			readonly
			value={debugLog || 'Лог пуст'}
			class="hairline mt-3 h-64 w-full resize-none rounded-2xl bg-(--color-bg-mute) p-3 font-mono text-[11px] leading-relaxed text-(--color-fg-mute) outline-none"
		></textarea>
	</section>
</div>
