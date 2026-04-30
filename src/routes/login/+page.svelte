<script lang="ts">
	import { authStore } from '$stores/auth.svelte';
	import { toasts } from '$stores/toast.svelte';
	import { Mail, Lock, Loader2, Sparkles, Eye, EyeOff } from 'lucide-svelte';

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let sending = $state(false);

	async function submit(event: Event) {
		event.preventDefault();
		if (sending) return;
		const trimmedEmail = email.trim();
		if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
			toasts.error('Введи корректный email');
			return;
		}
		if (password.length < 6) {
			toasts.error('Пароль минимум 6 символов');
			return;
		}
		sending = true;
		const { error } = await authStore.signInWithPassword(trimmedEmail, password);
		sending = false;
		if (error) {
			toasts.error(error);
			return;
		}
		toasts.success('Добро пожаловать');
	}
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6">
	<div class="hairline w-full rounded-3xl bg-(--color-bg-soft) p-6 shadow-xl">
		<div class="mb-6 flex items-center gap-3">
			<div
				class="grid size-12 place-items-center rounded-2xl bg-(--color-accent-soft) text-(--color-accent)"
			>
				<Sparkles size={22} />
			</div>
			<div>
				<h1 class="text-xl font-semibold tracking-tight">Habit</h1>
				<p class="text-sm text-(--color-fg-mute)">Войди по email и паролю</p>
			</div>
		</div>

		<form onsubmit={submit} class="flex flex-col gap-3">
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium uppercase tracking-wide text-(--color-fg-mute)">
					Email
				</span>
				<div
					class="flex items-center gap-2 rounded-2xl border border-(--color-border) bg-(--color-bg-mute) px-3 py-2.5 focus-within:border-(--color-accent)"
				>
					<Mail size={18} class="text-(--color-fg-mute)" />
					<input
						type="email"
						required
						autocomplete="email"
						placeholder="you@example.com"
						class="flex-1 bg-transparent outline-none placeholder:text-(--color-fg-mute)"
						bind:value={email}
					/>
				</div>
			</label>

			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium uppercase tracking-wide text-(--color-fg-mute)">
					Пароль
				</span>
				<div
					class="flex items-center gap-2 rounded-2xl border border-(--color-border) bg-(--color-bg-mute) px-3 py-2.5 focus-within:border-(--color-accent)"
				>
					<Lock size={18} class="text-(--color-fg-mute)" />
					<input
						type={showPassword ? 'text' : 'password'}
						required
						minlength="6"
						autocomplete="current-password"
						placeholder="••••••••"
						class="flex-1 bg-transparent outline-none placeholder:text-(--color-fg-mute)"
						bind:value={password}
					/>
					<button
						type="button"
						onclick={() => (showPassword = !showPassword)}
						class="-mr-1 grid size-8 place-items-center rounded-lg text-(--color-fg-mute) hover:bg-(--color-bg-soft) hover:text-(--color-fg)"
						aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
					>
						{#if showPassword}
							<EyeOff size={16} />
						{:else}
							<Eye size={16} />
						{/if}
					</button>
				</div>
			</label>

			<button
				type="submit"
				disabled={sending}
				class="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-(--color-accent) px-4 py-3 text-sm font-medium text-white transition active:scale-[0.99] disabled:opacity-60"
			>
				{#if sending}
					<Loader2 size={18} class="animate-spin" />
				{/if}
				<span>Войти</span>
			</button>
		</form>
	</div>
</div>
