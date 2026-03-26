<script lang="ts">
	import { createRoom, createDirectMessage, joinRoomByAlias } from '$lib/matrix/client';
	import { setActiveRoom } from '$lib/stores/rooms.svelte';

	type Mode = 'create-room' | 'create-dm' | 'join-room';

	let mode = $state<Mode | null>(null);
	let input1 = $state(''); // room name / user id / room address
	let input2 = $state(''); // room topic
	let loading = $state(false);
	let error = $state('');

	function open(m: Mode) {
		mode = m;
		input1 = '';
		input2 = '';
		error = '';
	}

	function close() {
		if (loading) return;
		mode = null;
	}

	async function submit() {
		error = '';
		loading = true;
		try {
			let roomId: string;
			if (mode === 'create-room') {
				roomId = await createRoom(input1.trim(), input2.trim());
			} else if (mode === 'create-dm') {
				const userId = input1.trim();
				if (!userId.startsWith('@') || !userId.includes(':')) {
					error = 'Enter a valid Matrix user ID, e.g. @user:server.com';
					return;
				}
				roomId = await createDirectMessage(userId);
			} else {
				const alias = input1.trim();
				if (!alias.startsWith('#') && !alias.startsWith('!')) {
					error = 'Enter a room address (#room:server.com) or room ID (!id:server.com)';
					return;
				}
				roomId = await joinRoomByAlias(alias);
			}
			setActiveRoom(roomId);
			close();
		} catch (e: any) {
			error = e?.data?.error ?? e?.message ?? 'Something went wrong';
		} finally {
			loading = false;
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
	}
</script>

<!-- Action buttons -->
<div class="px-2 pt-2 pb-1 flex flex-col gap-1">
	<button
		onclick={() => open('create-dm')}
		class="flex-1 flex items-center gap-1 py-1 px-2 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
		title="New direct message"
	>
		<svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
		New DM
	</button>
	<button
		onclick={() => open('create-room')}
		class="flex-1 flex items-center gap-1 py-1 px-2 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
		title="Create room"
	>
		<svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
		Create new room
	</button>
	<button
		onclick={() => open('join-room')}
		class="flex-1 flex items-center gap-1 py-1 px-2 rounded text-xs text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
		title="Join room by address"
	>
		<svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"/></svg>
		Join room by address
	</button>
</div>

<!-- Modal -->
{#if mode !== null}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onclick={close}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-discord-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
			onclick={(e) => e.stopPropagation()}
			onkeydown={onKeydown}
		>
			<h2 class="text-lg font-bold text-discord-textPrimary">
				{#if mode === 'create-room'}Create a room
				{:else if mode === 'create-dm'}New direct message
				{:else}Join a room
				{/if}
			</h2>

			{#if mode === 'create-room'}
				<div class="flex flex-col gap-3">
					<div>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5">Room name</label>
						<input
							bind:value={input1}
							placeholder="my-room"
							class="w-full px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
						/>
					</div>
					<div>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5">Topic <span class="normal-case font-normal">(optional)</span></label>
						<input
							bind:value={input2}
							placeholder="What's this room about?"
							class="w-full px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
						/>
					</div>
				</div>
			{:else if mode === 'create-dm'}
				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5">User ID</label>
					<input
						bind:value={input1}
						placeholder="@user:server.com"
						class="w-full px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
					/>
				</div>
			{:else}
				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5">Room address or ID</label>
					<input
						bind:value={input1}
						placeholder="#room:server.com"
						class="w-full px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
						autofocus
					/>
				</div>
			{/if}

			{#if error}
				<p class="text-sm text-discord-error">{error}</p>
			{/if}

			<div class="flex justify-end gap-2 mt-1">
				<button
					onclick={close}
					disabled={loading}
					class="px-4 py-2 rounded text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-50"
				>Cancel</button>
				<button
					onclick={submit}
					disabled={loading || !input1.trim()}
					class="px-4 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 flex items-center gap-2"
				>
					{#if loading}
						<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
					{/if}
					{#if mode === 'create-room'}Create
					{:else if mode === 'create-dm'}Open DM
					{:else}Join
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
