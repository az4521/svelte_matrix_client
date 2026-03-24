<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	import SpaceSidebar from '$lib/components/layout/SpaceSidebar.svelte';
	import RoomList from '$lib/components/layout/RoomList.svelte';
	import MessageArea from '$lib/components/layout/MessageArea.svelte';

	import { auth, clearSession } from '$lib/stores/auth.svelte';
	import { roomsState, setActiveSpace } from '$lib/stores/rooms.svelte';
	import { initFavourites } from '$lib/stores/favourites.svelte';
	import {
		getSpaces,
		getOrphanRooms,
		getDirectRooms,
		getRoomsInSpace,
		getInvitedRooms,
		getSpaceLayout,
		fetchSpaceHierarchy,
		getRoom,
		logout,
		onRoomUpdate,
		onAccountData
	} from '$lib/matrix/client';

	let showSettings = $state(false);

	// Redirect if not authenticated
	$effect(() => {
		if (!auth.isAuthenticated) {
			goto('/');
		}
	});

	function refreshRooms() {
		const layout = getSpaceLayout();
		roomsState.spaceLayout = layout;
		const spaces = getSpaces();
		if (layout.order.length) {
			// Build a flat ordered list of all space IDs (including those inside folders)
			const allIds: string[] = [];
			for (const id of layout.order) {
				if (layout.folders[id]) {
					allIds.push(...layout.folders[id].spaceIds);
				} else {
					allIds.push(id);
				}
			}
			spaces.sort((a, b) => {
				const ai = allIds.indexOf(a.roomId);
				const bi = allIds.indexOf(b.roomId);
				return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
			});
		}
		roomsState.spaces = spaces;
		roomsState.orphanRooms = getOrphanRooms();
		roomsState.directRooms = getDirectRooms();
		roomsState.invitedRooms = getInvitedRooms();
		if (roomsState.activeSpaceId) {
			roomsState.roomsInSpace = getRoomsInSpace(roomsState.activeSpaceId);
		}
		roomsState.roomsTick++;
	}

	onMount(() => {
		if (!auth.isAuthenticated) {
			goto('/');
			return;
		}

		refreshRooms();

		const unsubRooms = onRoomUpdate(() => refreshRooms());
		const unsubFavourites = initFavourites();
		const unsubAccountData = onAccountData((type) => {
			if (type === 'im.client.space_layout' || type === 'im.client.space_order') refreshRooms();
		});
		return () => { unsubRooms(); unsubFavourites(); unsubAccountData(); };
	});

	// Update rooms list and fetch full hierarchy when selected space changes
	$effect(() => {
		const spaceId = roomsState.activeSpaceId; // only dependency we want
		const rooms = spaceId ? getRoomsInSpace(spaceId) : [];
		roomsState.roomsInSpace = rooms;

		if (spaceId) {
			roomsState.hierarchyLoading = true;
			fetchSpaceHierarchy(spaceId).then((hierarchy) => {
				// Only apply if the space hasn't changed while we were fetching
				if (roomsState.activeSpaceId === spaceId) {
					roomsState.spaceHierarchy = hierarchy;
					roomsState.hierarchyLoading = false;
				}
			});
		}
	});

	async function handleLogout() {
		try {
			await logout();
		} finally {
			clearSession();
			goto('/');
		}
	}

	// Derive directly from activeRoomId (a stable string) rather than the room arrays,
	// so sync-triggered array refreshes don't invalidate this derived and remount MessageArea.
	const activeRoom = $derived.by(() => {
		void roomsState.roomsTick; // re-derive when rooms refresh (e.g. after joining)
		return roomsState.activeRoomId ? getRoom(roomsState.activeRoomId) : null;
	});
</script>

<svelte:head>
	<title>Matrix Client</title>
</svelte:head>

{#if !auth.isAuthenticated}
	<div class="min-h-screen flex items-center justify-center bg-discord-backgroundTertiary">
		<div class="flex items-center gap-3 text-discord-textMuted">
			<div class="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
			<span>Redirecting…</span>
		</div>
	</div>
{:else}
	<div class="flex h-screen overflow-hidden bg-discord-background">
		<!-- Sync state banner -->
		{#if auth.syncState !== 'PREPARED' && auth.syncState !== 'SYNCING'}
			<div class="absolute top-0 left-0 right-0 z-50 bg-discord-warning/90 text-discord-backgroundTertiary text-sm font-medium text-center py-1.5">
				{#if auth.syncState === 'ERROR'}
					Connection error — trying to reconnect…
				{:else if auth.syncState === 'RECONNECTING'}
					Reconnecting…
				{:else}
					Syncing…
				{/if}
			</div>
		{/if}

		<SpaceSidebar onHomeClick={() => setActiveSpace(null)} onSettingsClick={() => showSettings = !showSettings} />

		<RoomList onLogout={handleLogout} />

		<main class="flex flex-1 min-w-0 overflow-hidden bg-discord-background">
			{#if activeRoom}
				<MessageArea room={activeRoom} showMemberList={true} />
			{:else}
				<div class="flex-1 flex flex-col items-center justify-center text-center p-8">
					<div class="w-24 h-24 rounded-full bg-discord-backgroundSecondary flex items-center justify-center mb-6">
						<span class="text-5xl font-bold text-discord-textMuted">#</span>
					</div>
					<h2 class="text-2xl font-bold text-discord-textPrimary mb-2">
						{roomsState.activeSpaceId === null ? 'Select a room' : 'Select a channel'}
					</h2>
					<p class="text-discord-textMuted max-w-sm">
						{roomsState.activeSpaceId === null
							? 'Choose a room or direct message from the sidebar to start chatting.'
							: 'Choose a channel from the list on the left to start chatting.'}
					</p>
				</div>
			{/if}
		</main>

		<!-- Settings overlay -->
		{#if showSettings}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
				role="presentation"
				onclick={(e) => { if (e.target === e.currentTarget) showSettings = false; }}
				onkeydown={(e) => { if (e.key === 'Escape') showSettings = false; }}
			>
				<div class="bg-discord-backgroundSecondary rounded-lg shadow-2xl p-6 w-96 max-w-full mx-4">
					<h2 class="text-xl font-bold text-discord-textPrimary mb-4">Settings</h2>
					<div class="space-y-3 text-sm">
						<div class="flex justify-between items-center py-2 border-b border-discord-divider">
							<span class="text-discord-textMuted font-medium">User ID</span>
							<span class="text-discord-textPrimary font-mono text-xs">{auth.userId}</span>
						</div>
						<div class="flex justify-between items-center py-2 border-b border-discord-divider">
							<span class="text-discord-textMuted font-medium">Homeserver</span>
							<span class="text-discord-textPrimary text-xs">{auth.homeserverUrl}</span>
						</div>
						<div class="flex justify-between items-center py-2 border-b border-discord-divider">
							<span class="text-discord-textMuted font-medium">Sync state</span>
							<span class="text-discord-textPrimary text-xs">{auth.syncState}</span>
						</div>
					</div>
					<div class="mt-6 flex gap-3">
						<button
							onclick={handleLogout}
							class="flex-1 py-2 bg-discord-danger hover:bg-discord-danger/80 text-white rounded font-medium text-sm transition-colors"
						>Log Out</button>
						<button
							onclick={() => showSettings = false}
							class="flex-1 py-2 bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary rounded font-medium text-sm transition-colors"
						>Close</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
