<script lang="ts">
	import { base } from '$app/paths';
	import { authStore } from '$stores/auth.svelte';
	import { toasts } from '$stores/toast.svelte';
	import { Mail, Loader2, Sparkles } from 'lucide-svelte';

	let email = $state('');
	let sending = $state(false);
	let sent = $state(false);

	async function submit(event: Event) {
		event.preventDefault();
		if (sending) return;
		const trimmed = email.trim();
		if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
			toasts.error('Введи корректный email');
			return;
		}
		sending = true;
		const redirectTo =
			typeof window === 'undefined'
				? undefined
				: `${window.location.origin}${base}/auth/callback`;
		const { error } = await authStore.signInWithEmail(trimmed, redirectTo);
		sending = false;
		if (error) {
			toasts.error(error);
			return;
		}
		sent = true;
		toasts.success('Письмо отправлено');
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
				<p class="text-sm text-(--color-fg-mute)">Войди по магической ссылке</p>
			</div>
		</div>

		{#if sent}
			<div class="rounded-2xl bg-(--color-bg-mute) p-4 text-sm">
				<p class="font-medium">Проверь почту</p>
				<p class="mt-1 text-(--color-fg-mute)">
					Мы отправили ссылку на <span class="text-(--color-fg)">{email}</span>. Открой её на этом
					устройстве.
				</p>
				<button
					type="button"
					class="mt-3 text-(--color-accent) underline-offset-4 hover:underline"
					onclick={() => (sent = false)}
				>
					Отправить ещё раз
				</button>
			</div>
		{:else}
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
				<button
					type="submit"
					disabled={sending}
					class="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-(--color-accent) px-4 py-3 text-sm font-medium text-white transition active:scale-[0.99] disabled:opacity-60"
				>
					{#if sending}
						<Loader2 size={18} class="animate-spin" />
					{/if}
					<span>Отправить magic link</span>
				</button>
			</form>
		{/if}
	</div>
</div>
