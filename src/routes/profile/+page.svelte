<script lang="ts">
	import PageHeadText from '$components/PageHeadText.svelte';
	import SwitchToggle from '$components/SwitchToggle.svelte';
	import { authStore } from '$stores/auth.svelte';
	import { themeStore } from '$stores/theme.svelte';
	import { profileStore } from '$stores/profile.svelte';
	import { toasts } from '$stores/toast.svelte';
	import { onMount } from 'svelte';
	import {
		disableHabitReminders,
		enableHabitReminders,
		getRemindersEnabledConsolidated,
		requestServerPushTest,
		showHabitPushReminderPreviewAfterDelay,
		syncUserReminderTimezone,
		verifyPushReminderEnabled
	} from '$lib/push/reminders';
	import { isSupabaseConfigured } from '$supabase/client';
	import { LogOut, Sun, Moon, Bell } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let localName = $state(profileStore.name);
	let remindersOn = $state(false);
	let remindersLoading = $state(true);
	let remindersBusy = $state(false);
	/** Last user id we finished a settings fetch for (avoids refetch thrash when `user` object is replaced). */
	let remindersHydratedForUserId = $state<string | null>(null);
	let testPushWaiting = $state(false);
	let serverPushWaiting = $state(false);

	const reminderUserId = $derived(authStore.user?.id ?? '');

	const remindersInitialSyncPending = $derived(
		!!reminderUserId &&
			remindersLoading &&
			remindersHydratedForUserId !== reminderUserId
	);

	$effect(() => {
		localName = profileStore.name;
	});

	$effect(() => {
		const uid = authStore.user?.id;
		if (!uid || !isSupabaseConfigured) {
			remindersHydratedForUserId = null;
			remindersLoading = false;
			remindersOn = false;
			return;
		}
		if (remindersHydratedForUserId === uid) {
			return;
		}

		let cancelled = false;
		remindersLoading = true;
		void getRemindersEnabledConsolidated(uid)
			.then((on) => {
				if (cancelled || authStore.user?.id !== uid) return;
				remindersOn = on;
			})
			.catch(() => {
				if (cancelled || authStore.user?.id !== uid) return;
				remindersOn = false;
			})
			.finally(() => {
				if (cancelled) return;
				remindersLoading = false;
				if (authStore.user?.id === uid) {
					remindersHydratedForUserId = uid;
				}
			});

		return () => {
			cancelled = true;
		};
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

	async function flipReminders() {
		const uid = authStore.user?.id;
		if (!uid || remindersBusy || remindersInitialSyncPending) return;
		remindersBusy = true;
		const next = !remindersOn;
		try {
			if (next) {
				const { error } = await enableHabitReminders(uid);
				if (error) {
					toasts.push(error, 'error');
					remindersOn = false;
					return;
				}
				await syncUserReminderTimezone(uid);
				let ok = await verifyPushReminderEnabled(uid);
				if (!ok) {
					ok = await getRemindersEnabledConsolidated(uid);
				}
				remindersOn = ok;
				if (ok) {
					remindersHydratedForUserId = uid;
					toasts.push('Напоминания включены');
				} else {
					toasts.push('Не удалось подтвердить подписку на уведомления', 'error');
				}
			} else {
				const { error } = await disableHabitReminders(uid);
				if (error) {
					toasts.push(error, 'error');
					return;
				}
				remindersOn = false;
				remindersHydratedForUserId = uid;
				toasts.push('Напоминания выключены');
			}
		} finally {
			remindersBusy = false;
		}
	}

	function flipTheme() {
		themeStore.toggle();
	}

	async function runTestPushReminder() {
		if (testPushWaiting || typeof window === 'undefined') return;
		testPushWaiting = true;
		toasts.push('Через ~10 с — локальный тест (без сервера)');
		try {
			const iconUrl = new URL(`${base}/icons/192.png`, window.location.origin).href;
			const { error } = await showHabitPushReminderPreviewAfterDelay(10_000, {
				iconUrl,
				badgeUrl: iconUrl
			});
			if (error) toasts.push(error, 'error');
		} finally {
			testPushWaiting = false;
		}
	}

	async function runServerPushTest() {
		const uid = authStore.user?.id;
		if (!uid || serverPushWaiting || remindersBusy) return;
		if (!remindersOn) {
			toasts.push('Сначала включи уведомления', 'error');
			return;
		}
		serverPushWaiting = true;
		toasts.push('Отправляем push с сервера…');
		try {
			const { error } = await requestServerPushTest(uid);
			if (error) toasts.push(error, 'error');
			else toasts.push('Серверный push отправлен');
		} finally {
			serverPushWaiting = false;
		}
	}

	onMount(() => {
		function refreshRemindersFromDevice() {
			if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
			const uid = authStore.user?.id;
			if (!uid || !isSupabaseConfigured || remindersBusy) return;
			if (remindersHydratedForUserId !== uid) return;
			void getRemindersEnabledConsolidated(uid).then((on) => {
				if (authStore.user?.id !== uid) return;
				remindersOn = on;
			});
		}
		document.addEventListener('visibilitychange', refreshRemindersFromDevice);
		window.addEventListener('pageshow', refreshRemindersFromDevice);
		return () => {
			document.removeEventListener('visibilitychange', refreshRemindersFromDevice);
			window.removeEventListener('pageshow', refreshRemindersFromDevice);
		};
	});
</script>

<div class="page-shell gap-5 pb-6 sm:gap-6">
	<header>
		<PageHeadText kicker="Аккаунт" title="Профиль" subtitle={authStore.user?.email ?? '—'} />
	</header>

	<section class="hairline rounded-3xl bg-(--color-bg-soft) p-4">
		<label class="flex flex-col gap-2">
			<span class="text-xs font-bold uppercase tracking-wide text-(--color-fg-mute)">Имя</span>
			<input
				type="text"
				bind:value={localName}
				onblur={save}
				placeholder="Как тебя звать?"
				maxlength="40"
				class="hairline rounded-2xl bg-(--color-bg-mute) px-3 py-2.5 text-base font-medium outline-none placeholder:text-(--color-fg-mute)"
			/>
		</label>
	</section>

	<section class="hairline rounded-3xl bg-(--color-bg-soft) p-2">
		{#if isSupabaseConfigured}
			<div
				class="flex w-full items-center gap-3 rounded-2xl px-3 py-3"
				class:opacity-50={remindersBusy || remindersInitialSyncPending}
			>
				<span class="grid size-9 shrink-0 place-items-center rounded-xl bg-(--color-bg-mute)">
					<Bell size={18} />
				</span>
				<span class="min-w-0 flex-1 font-medium" id="reminders-profile-label">Уведомления</span>
				<div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
					<button
						type="button"
						class="tap-target hairline rounded-xl px-2.5 py-1.5 text-xs font-semibold text-(--color-fg-mute) transition-opacity disabled:opacity-40"
						disabled={testPushWaiting || remindersBusy || remindersInitialSyncPending}
						onclick={() => void runTestPushReminder()}
					>
						{testPushWaiting ? '10 с…' : 'Локально'}
					</button>
					<button
						type="button"
						class="tap-target hairline rounded-xl px-2.5 py-1.5 text-xs font-semibold text-(--color-fg-mute) transition-opacity disabled:opacity-40"
						disabled={serverPushWaiting || remindersBusy || remindersInitialSyncPending}
						onclick={() => void runServerPushTest()}
					>
						{serverPushWaiting ? '…' : 'С сервера'}
					</button>
					<SwitchToggle
						pressed={remindersOn}
						disabled={remindersBusy || remindersInitialSyncPending}
						aria-labelledby="reminders-profile-label"
						onFlip={() => void flipReminders()}
					/>
				</div>
			</div>
		{/if}

		<div class="flex w-full items-center gap-3 rounded-2xl px-3 py-3">
			<span class="grid size-9 shrink-0 place-items-center rounded-xl bg-(--color-bg-mute)">
				{#if themeStore.theme === 'dark'}
					<Moon size={18} />
				{:else}
					<Sun size={18} />
				{/if}
			</span>
			<span class="min-w-0 flex-1 font-medium" id="theme-profile-label">
				Тема: {themeStore.theme === 'dark' ? 'тёмная' : 'светлая'}
			</span>
			<SwitchToggle
				pressed={themeStore.theme === 'dark'}
				aria-labelledby="theme-profile-label"
				onFlip={flipTheme}
			/>
		</div>

		<button
			type="button"
			onclick={logout}
			class="tap-target flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left font-medium text-rose-400 active:scale-[0.99]"
		>
			<span class="grid size-9 place-items-center rounded-xl bg-rose-500/15">
				<LogOut size={18} />
			</span>
			<span>Выйти</span>
		</button>
	</section>
</div>
