<script lang="ts">
	import PageHeadText from '$components/PageHeadText.svelte';
	import { authStore } from '$stores/auth.svelte';
	import { themeStore } from '$stores/theme.svelte';
	import { profileStore } from '$stores/profile.svelte';
	import { toasts } from '$stores/toast.svelte';
	import {
		disableHabitReminders,
		enableHabitReminders,
		fetchReminderSettings
	} from '$lib/push/reminders';
	import { isSupabaseConfigured } from '$supabase/client';
	import { LogOut, Sun, Moon, Bell } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let localName = $state(profileStore.name);
	let remindersOn = $state(false);
	let remindersLoading = $state(true);
	let remindersBusy = $state(false);

	$effect(() => {
		localName = profileStore.name;
	});

	$effect(() => {
		const uid = authStore.user?.id;
		if (!uid || !isSupabaseConfigured) {
			remindersLoading = false;
			remindersOn = false;
			return;
		}
		remindersLoading = true;
		void fetchReminderSettings(uid).then((on) => {
			remindersOn = on;
			remindersLoading = false;
		});
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

	async function toggleReminders() {
		const uid = authStore.user?.id;
		if (!uid || remindersBusy) return;
		remindersBusy = true;
		const next = !remindersOn;
		if (next) {
			const { error } = await enableHabitReminders(uid);
			if (error) {
				toasts.push(error, 'error');
				remindersBusy = false;
				return;
			}
			remindersOn = true;
			toasts.push('Напоминания включены');
		} else {
			const { error } = await disableHabitReminders(uid);
			if (error) {
				toasts.push(error, 'error');
				remindersBusy = false;
				return;
			}
			remindersOn = false;
			toasts.push('Напоминания выключены');
		}
		remindersBusy = false;
	}
</script>

<div class="page-shell gap-5 pb-6 sm:gap-6">
	<header>
		<PageHeadText kicker="Аккаунт" title="Профиль" subtitle={authStore.user?.email ?? '—'} />
	</header>

	{#if isSupabaseConfigured}
		<section class="hairline rounded-3xl bg-(--color-bg-soft) p-2">
			<button
				type="button"
				disabled={remindersLoading || remindersBusy}
				onclick={toggleReminders}
				class="tap-target flex w-full flex-col items-stretch gap-1 rounded-2xl px-3 py-3 text-left font-medium active:scale-[0.99] disabled:opacity-50"
			>
				<span class="flex items-center gap-3">
					<span class="grid size-9 place-items-center rounded-xl bg-(--color-bg-mute)">
						<Bell size={18} />
					</span>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span>Напоминание о дневнике</span>
						<span class="text-xs font-normal text-(--color-fg-mute)">
							Около 21:00 по времени устройства, если за день ещё не заполнен дневник. Часовой пояс
							обновляется при открытии приложения.
						</span>
					</span>
					<span class="shrink-0 text-sm text-(--color-fg-mute)">
						{remindersLoading ? '…' : remindersOn ? 'вкл' : 'выкл'}
					</span>
				</span>
			</button>
		</section>
	{/if}

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
		<button
			type="button"
			onclick={() => themeStore.toggle()}
			class="tap-target flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left font-medium active:scale-[0.99]"
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
			<span class="text-sm text-(--color-fg-mute)">переключить</span>
		</button>

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
