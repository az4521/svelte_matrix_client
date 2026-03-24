<script lang="ts">
	import type { Room } from 'matrix-js-sdk';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import { getRoomAvatar, getRoomDisplayName, getUnreadCount, joinRoom, leaveRoom, acceptInvite, rejectInvite, getInviteSender } from '$lib/matrix/client';
	import { roomsState, setActiveRoom, setActiveSpace } from '$lib/stores/rooms.svelte';
	import { auth } from '$lib/stores/auth.svelte';

	interface Props {
		onLogout: () => void;
	}

	let { onLogout }: Props = $props();

	// Rooms currently being joined (show spinner)
	let joiningIds = $state(new Set<string>());
	let inviteActionIds = $state(new Set<string>());

	// Context menu state
	let contextMenu = $state<{ roomId: string; x: number; y: number } | null>(null);

	function openContextMenu(e: MouseEvent, roomId: string) {
		e.preventDefault();
		contextMenu = { roomId, x: e.clientX, y: e.clientY };
	}

	async function handleLeave(roomId: string) {
		contextMenu = null;
		try {
			await leaveRoom(roomId);
			if (roomsState.activeRoomId === roomId) roomsState.activeRoomId = null;
		} catch (err) {
			console.error('Failed to leave room:', err);
		}
	}

	const title = $derived(
		roomsState.activeSpaceId === null
			? 'Home'
			: roomsState.spaces.find((s) => s.roomId === roomsState.activeSpaceId)?.name || 'Space'
	);

	const visibleRooms = $derived(
		roomsState.activeSpaceId === null ? roomsState.orphanRooms : roomsState.roomsInSpace
	);

	const unjoinedRooms = $derived(
		roomsState.activeSpaceId !== null
			? roomsState.spaceHierarchy.filter((r) => !r.isJoined)
			: []
	);

	const showDMs = $derived(roomsState.activeSpaceId === null && roomsState.directRooms.length > 0);

	async function handleJoin(roomId: string, via?: string[]) {
		joiningIds = new Set(joiningIds).add(roomId);
		try {
			await joinRoom(roomId, via);
			// Mark as joined in hierarchy so the UI updates immediately
			roomsState.spaceHierarchy = roomsState.spaceHierarchy.map((r) =>
				r.roomId === roomId ? { ...r, isJoined: true } : r
			);
			// Navigate into the room
			setActiveRoom(roomId);
		} catch (err) {
			console.error('Failed to join room:', err);
		} finally {
			const next = new Set(joiningIds);
			next.delete(roomId);
			joiningIds = next;
		}
	}

	async function handleAccept(roomId: string) {
		inviteActionIds = new Set(inviteActionIds).add(roomId);
		try {
			await acceptInvite(roomId);
			setActiveRoom(roomId);
		} catch (err) {
			console.error('Failed to accept invite:', err);
		} finally {
			const next = new Set(inviteActionIds);
			next.delete(roomId);
			inviteActionIds = next;
		}
	}

	async function handleReject(roomId: string) {
		inviteActionIds = new Set(inviteActionIds).add(roomId);
		try {
			await rejectInvite(roomId);
		} catch (err) {
			console.error('Failed to reject invite:', err);
		} finally {
			const next = new Set(inviteActionIds);
			next.delete(roomId);
			inviteActionIds = next;
		}
	}

	function roomButton(room: Room) {
		const isActive = roomsState.activeRoomId === room.roomId;
		roomsState.unreadTick; // track read receipt / new message changes
		const unread = getUnreadCount(room);
		return { isActive, unread };
	}
</script>

<div class="w-60 bg-discord-backgroundSecondary flex flex-col flex-shrink-0">
	<!-- Header -->
	<div class="h-12 px-4 flex items-center border-b border-discord-divider shadow-sm flex-shrink-0">
		<h2 class="font-semibold text-discord-textPrimary truncate flex-1">{title}</h2>
		{#if roomsState.hierarchyLoading}
			<div class="w-3.5 h-3.5 border-2 border-discord-textMuted border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
		{/if}
	</div>

	<!-- Room list -->
	<div class="flex-1 overflow-y-auto py-2">

		<!-- Pending invites -->
		{#if roomsState.invitedRooms.length > 0}
			<div class="px-2 mb-2">
				<p class="px-2 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide">Invites</p>
				{#each roomsState.invitedRooms as room (room.roomId)}
					{@const busy = inviteActionIds.has(room.roomId)}
					{@const sender = getInviteSender(room)}
					<div class="flex flex-col gap-1.5 px-2 py-2 rounded bg-discord-messageHover mb-1">
						<div class="flex items-center gap-2 min-w-0">
							<Avatar src={getRoomAvatar(room)} name={getRoomDisplayName(room)} size={24} />
							<div class="flex-1 min-w-0">
								<p class="text-sm font-semibold text-discord-textPrimary truncate">{getRoomDisplayName(room)}</p>
								{#if sender}
									<p class="text-xs text-discord-textMuted truncate">from {sender}</p>
								{/if}
							</div>
						</div>
						<div class="flex gap-1.5">
							<button
								onclick={() => handleAccept(room.roomId)}
								disabled={busy}
								class="flex-1 py-1 rounded text-xs font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50"
							>Accept</button>
							<button
								onclick={() => handleReject(room.roomId)}
								disabled={busy}
								class="flex-1 py-1 rounded text-xs font-semibold bg-discord-backgroundPrimary hover:bg-discord-danger text-discord-textMuted hover:text-white transition-colors disabled:opacity-50"
							>Reject</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Joined rooms / channels -->
		{#if visibleRooms.length > 0}
			<div class="px-2 mb-2">
				<p class="px-2 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide">
					{roomsState.activeSpaceId ? 'Channels' : 'Rooms'}
				</p>
				{#each visibleRooms as room (room.roomId)}
					{@const { isActive, unread } = roomButton(room)}
					<button
						onclick={() => setActiveRoom(room.roomId)}
						oncontextmenu={(e) => openContextMenu(e, room.roomId)}
						class="w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left"
						class:bg-discord-messageHover={isActive}
						class:text-discord-textPrimary={isActive || unread > 0}
						class:text-discord-textMuted={!isActive && unread === 0}
						class:font-semibold={unread > 0}
						class:hover:bg-discord-messageHover={!isActive}
						class:hover:text-discord-textPrimary={!isActive}
					>
						<span class="w-5 h-5 flex-shrink-0 opacity-70 font-semibold flex items-center justify-center">#</span>
						<span class="flex-1 text-sm truncate">{getRoomDisplayName(room)}</span>
						{#if unread > 0}
							<span class="flex-shrink-0 bg-discord-danger text-white text-xs font-bold rounded-full px-1.5 min-w-[1.2rem] text-center">
								{unread > 99 ? '99+' : unread}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Unjoined rooms (from space hierarchy) -->
		{#if unjoinedRooms.length > 0}
			<div class="px-2 mb-2">
				<p class="px-2 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide">
					Browse Channels
				</p>
				{#each unjoinedRooms as room (room.roomId)}
					{@const isJoining = joiningIds.has(room.roomId)}
					<div class="flex items-center gap-2 px-2 py-1.5 rounded group hover:bg-discord-messageHover transition-colors">
						<!-- Channel icon -->
						<span class="w-5 h-5 flex-shrink-0 text-discord-textMuted opacity-50 font-semibold flex items-center justify-center">#</span>

						<!-- Name + member count -->
						<div class="flex-1 min-w-0">
							<p class="text-sm text-discord-textMuted group-hover:text-discord-textPrimary truncate transition-colors">
								{room.name}
							</p>
							{#if room.numMembers > 0}
								<p class="text-xs text-discord-textMuted opacity-70">{room.numMembers} members</p>
							{/if}
						</div>

						<!-- Join button -->
						<button
							onclick={() => handleJoin(room.roomId, room.via)}
							disabled={isJoining}
							class="flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
						>
							{#if isJoining}
								<span class="flex items-center gap-1">
									<span class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
								</span>
							{:else}
								Join
							{/if}
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Direct messages -->
		{#if showDMs}
			<div class="px-2 mb-2">
				<p class="px-2 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide">
					Direct Messages
				</p>
				{#each roomsState.directRooms as room (room.roomId)}
					{@const { isActive, unread } = roomButton(room)}
					{@const avatarSrc = getRoomAvatar(room)}
					<button
						onclick={() => setActiveRoom(room.roomId)}
						oncontextmenu={(e) => openContextMenu(e, room.roomId)}
						class="w-full flex items-center gap-2 px-2 py-1.5 rounded transition-colors text-left"
						class:bg-discord-messageHover={isActive}
						class:text-discord-textPrimary={isActive || unread > 0}
						class:text-discord-textMuted={!isActive && unread === 0}
						class:hover:bg-discord-messageHover={!isActive}
						class:hover:text-discord-textPrimary={!isActive}
					>
						<Avatar src={avatarSrc} name={getRoomDisplayName(room)} size={32} />
						<span class="flex-1 text-sm truncate">{getRoomDisplayName(room)}</span>
						{#if unread > 0}
							<span class="flex-shrink-0 bg-discord-danger text-white text-xs font-bold rounded-full px-1.5 min-w-[1.2rem] text-center">
								{unread > 99 ? '99+' : unread}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		{#if visibleRooms.length === 0 && unjoinedRooms.length === 0 && !roomsState.hierarchyLoading && !showDMs}
			<p class="px-4 py-8 text-sm text-discord-textMuted text-center">No rooms yet</p>
		{/if}
	</div>

	<!-- User bar -->
	<div class="h-14 px-2 flex items-center gap-2 bg-discord-backgroundTertiary flex-shrink-0">
		<div class="relative">
			<Avatar name={auth.userId || '?'} size={32} />
			<div class="absolute bottom-0 right-0 w-3 h-3 bg-discord-online rounded-full border-2 border-discord-backgroundTertiary"></div>
		</div>
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-discord-textPrimary truncate">
				{auth.userId?.split(':')[0].replace('@', '') ?? 'Unknown'}
			</p>
			<p class="text-xs text-discord-textMuted truncate">{auth.userId ?? ''}</p>
		</div>
		<button
			onclick={onLogout}
			class="p-1.5 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors"
			title="Logout"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
			</svg>
		</button>
	</div>
</div>

{#if contextMenu}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50" onclick={() => contextMenu = null}></div>
	<div
		class="fixed z-50 bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl py-1 min-w-36"
		style="left: {contextMenu.x}px; top: {contextMenu.y}px"
	>
		<button
			onclick={() => handleLeave(contextMenu!.roomId)}
			class="w-full text-left px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white transition-colors"
		>Leave Room</button>
	</div>
{/if}
