<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { login, reconnect, startSync } from '$lib/matrix/client';
	import { auth, saveSession, loadStoredSession } from '$lib/stores/auth.svelte';

	let homeserverUrl = $state('https://matrix.org');
	let username = $state('');
	let password = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let statusMsg = $state('');

	onMount(() => {
		// Try to restore a previous session
		const stored = loadStoredSession();
		if (stored) {
			statusMsg = 'Restoring session…';
			isLoading = true;
			reconnect(stored.homeserverUrl, stored.userId, stored.accessToken, stored.deviceId);
			auth.userId = stored.userId;
			auth.homeserverUrl = stored.homeserverUrl;
			auth.accessToken = stored.accessToken;
			auth.deviceId = stored.deviceId;

			let navigated = false;
		startSync((state) => {
				auth.syncState = state;
				if ((state === 'PREPARED' || state === 'SYNCING') && !navigated) {
					navigated = true;
					auth.isAuthenticated = true;
					goto('/app');
				} else if (state === 'ERROR' || state === 'STOPPED') {
					isLoading = false;
					statusMsg = '';
					error = 'Failed to reconnect. Please log in again.';
				}
			});
		}
	});

	async function handleLogin() {
		error = '';
		statusMsg = '';
		isLoading = true;

		try {
			let url = homeserverUrl.trim();
			if (!url.startsWith('http')) url = 'https://' + url;
			url = url.replace(/\/$/, '');

			statusMsg = 'Logging in…';
			const result = await login(url, username, password);

			saveSession({
				userId: result.userId,
				accessToken: result.accessToken,
				deviceId: result.deviceId,
				homeserverUrl: result.homeserverUrl
			});

			statusMsg = 'Syncing…';
			let navigated = false;
			startSync((state) => {
				auth.syncState = state;
				if ((state === 'PREPARED' || state === 'SYNCING') && !navigated) {
					navigated = true;
					goto('/app');
				} else if (state === 'ERROR') {
					isLoading = false;
					statusMsg = '';
					error = 'Sync error. Check your connection.';
				}
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Login failed. Check your credentials.';
			isLoading = false;
			statusMsg = '';
		}
	}
</script>

<svelte:head>
	<title>Matrix Client — Sign In</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-discord-backgroundTertiary p-4">
	<div class="w-full max-w-md">
		<!-- Card -->
		<div class="bg-discord-background rounded-lg shadow-2xl p-8">
			<!-- Header -->
			<div class="text-center mb-8">
				<div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-discord-accent mb-4">
					<svg class="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
						<path d="M5.88 2.39a1 1 0 1 0-1.94.49l.64 2.51A.85.85 0 0 1 3.72 6.5H2a1 1 0 0 0 0 2h1.27l-.63 2.47a1 1 0 1 0 1.94.49L5.5 8.5H9l-.63 2.47a1 1 0 1 0 1.94.49L11.24 8.5H13a1 1 0 0 0 0-2h-1.27l.7-2.73a1 1 0 0 0-1.94-.49L9.58 6.5H6.5l-.62-2.11z"/>
					</svg>
				</div>
				<h1 class="text-2xl font-bold text-discord-textPrimary">Welcome back!</h1>
				<p class="text-discord-textSecondary mt-1">Sign in to your Matrix account</p>
			</div>

			<!-- Error banner -->
			{#if error}
				<div class="mb-4 p-3 bg-discord-danger/10 border border-discord-danger/30 rounded-lg">
					<p class="text-discord-danger text-sm">{error}</p>
				</div>
			{/if}

			<!-- Status message -->
			{#if statusMsg && isLoading}
				<div class="mb-4 p-3 bg-discord-accent/10 border border-discord-accent/30 rounded-lg flex items-center gap-3">
					<div class="w-4 h-4 border-2 border-discord-accent border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
					<p class="text-discord-accent text-sm">{statusMsg}</p>
				</div>
			{/if}

			<!-- Form -->
			<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }} class="space-y-4">
				<!-- Homeserver -->
				<div>
					<label for="server" class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5">
						Homeserver
					</label>
					<input
						id="server"
						type="text"
						bind:value={homeserverUrl}
						placeholder="https://matrix.org"
						disabled={isLoading}
						class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
						required
					/>
				</div>

				<!-- Username -->
				<div>
					<label for="username" class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5">
						Username
					</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						placeholder="@you:matrix.org"
						disabled={isLoading}
						class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
						required
					/>
				</div>

				<!-- Password -->
				<div>
					<label for="password" class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5">
						Password
					</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						placeholder="••••••••••"
						disabled={isLoading}
						class="w-full px-3 py-2.5 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none transition-colors disabled:opacity-60 text-sm"
						required
					/>
				</div>

				<button
					type="submit"
					disabled={isLoading || !username || !password}
					class="w-full py-2.5 bg-discord-accent hover:bg-discord-accentHover text-white font-semibold rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2"
				>
					{#if isLoading}
						<span class="flex items-center justify-center gap-2">
							<span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
							{statusMsg || 'Please wait…'}
						</span>
					{:else}
						Log In
					{/if}
				</button>
			</form>

			<p class="text-center text-xs text-discord-textMuted mt-6 leading-relaxed">
				Your credentials are sent directly to your homeserver and never stored by this app beyond your device.
			</p>
		</div>
	</div>
</div>
