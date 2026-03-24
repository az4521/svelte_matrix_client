<script lang="ts">
	import type { Room } from 'matrix-js-sdk';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import { getRoomAvatar, getRoomDisplayName, getUnreadCount, joinRoom, leaveRoom, acceptInvite, rejectInvite, getInviteSender, getMyPowerLevel, getRoomPowerLevels, getRoom, getRoomsInSpace } from '$lib/matrix/client';
	import { roomsState, setActiveRoom, setActiveSpace } from '$lib/stores/rooms.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import RoomSettings from '$lib/components/layout/RoomSettings.svelte';

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

	let ctxTouchTimer: ReturnType<typeof setTimeout> | null = null;
	let ctxTouchStartX = 0, ctxTouchStartY = 0;

	function onRoomTouchStart(e: TouchEvent, roomId: string) {
		const t = e.touches[0];
		ctxTouchStartX = t.clientX;
		ctxTouchStartY = t.clientY;
		ctxTouchTimer = setTimeout(() => {
			ctxTouchTimer = null;
			navigator.vibrate?.(50);
			contextMenu = { roomId, x: ctxTouchStartX, y: ctxTouchStartY };
		}, 500);
	}

	function onRoomTouchMove(e: TouchEvent) {
		if (!ctxTouchTimer) return;
		const t = e.touches[0];
		const dx = t.clientX - ctxTouchStartX;
		const dy = t.clientY - ctxTouchStartY;
		if (Math.sqrt(dx * dx + dy * dy) > 10) {
			clearTimeout(ctxTouchTimer);
			ctxTouchTimer = null;
		}
	}

	function onRoomTouchEnd() {
		if (ctxTouchTimer) { clearTimeout(ctxTouchTimer); ctxTouchTimer = null; }
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

	let showSpaceSettings = $state(false);

	const activeSpaceRoom = $derived(
		roomsState.activeSpaceId ? getRoom(roomsState.activeSpaceId) : null
	);

	const canAccessSpaceSettings = $derived.by(() => {
		if (!activeSpaceRoom) return false;
		const myPl = getMyPowerLevel(activeSpaceRoom);
		const pl = getRoomPowerLevels(activeSpaceRoom);
		return myPl >= pl.state_default || myPl >= pl.kick || myPl >= pl.ban;
	});

	function roomButton(room: Room) {
		const isActive = roomsState.activeRoomId === room.roomId;
		roomsState.unreadTick; // track read receipt / new message changes
		const unread = getUnreadCount(room);
		return { isActive, unread };
	}
</script>

<div class="w-60 bg-discord-backgroundSecondary flex flex-col flex-shrink-0">
	<!-- Header -->
	<div class="h-12 px-4 flex items-center border-b border-discord-divider shadow-sm flex-shrink-0 gap-2">
		<h2 class="font-semibold text-discord-textPrimary truncate flex-1">{title}</h2>
		{#if roomsState.hierarchyLoading}
			<div class="w-3.5 h-3.5 border-2 border-discord-textMuted border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
		{/if}
		{#if canAccessSpaceSettings}
			<button
				onclick={() => showSpaceSettings = true}
				class="p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
				title="Space settings"
			>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
					<path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.01 7.01 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>
				</svg>
			</button>
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
			<div class="mb-2">
				<p class="px-2 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide">
					{roomsState.activeSpaceId ? 'Channels' : 'Rooms'}
				</p>
				{#each visibleRooms as room (room.roomId)}
					{@const { isActive, unread } = roomButton(room)}
					<button
						onclick={() => setActiveRoom(room.roomId)}
						oncontextmenu={(e) => openContextMenu(e, room.roomId)}
					ontouchstart={(e) => onRoomTouchStart(e, room.roomId)}
					ontouchmove={onRoomTouchMove}
					ontouchend={onRoomTouchEnd}
						class="w-full flex items-center gap-2 pr-2 py-1.5 transition-colors text-left"
						class:text-discord-textPrimary={isActive || unread > 0}
						class:text-discord-textMuted={!isActive && unread === 0}
						class:font-semibold={unread > 0}
						class:hover:bg-discord-messageHover={!isActive}
						class:hover:text-discord-textPrimary={!isActive}
						style={isActive ? 'border-left: 3px solid var(--discord-accent); background: linear-gradient(to right, var(--discord-bg-selected) 85%, var(--discord-bg-secondary)); padding-left: calc(0.5rem - 3px);' : 'padding-left: 0.5rem;'}
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
			<div class="mb-2">
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
					ontouchstart={(e) => onRoomTouchStart(e, room.roomId)}
					ontouchmove={onRoomTouchMove}
					ontouchend={onRoomTouchEnd}
						class="w-full flex items-center gap-2 pr-2 py-1.5 transition-colors text-left"
						class:text-discord-textPrimary={isActive || unread > 0}
						class:text-discord-textMuted={!isActive && unread === 0}
						class:hover:bg-discord-messageHover={!isActive}
						class:hover:text-discord-textPrimary={!isActive}
						style={isActive ? 'border-left: 3px solid var(--discord-accent); background: linear-gradient(to right, var(--discord-bg-selected) 85%, var(--discord-bg-secondary)); padding-left: calc(0.5rem - 3px);' : 'padding-left: 0.5rem;'}
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

{#if showSpaceSettings && activeSpaceRoom}
	<RoomSettings room={activeSpaceRoom} onClose={() => showSpaceSettings = false} onUpdate={() => { if (roomsState.activeSpaceId) roomsState.roomsInSpace = getRoomsInSpace(roomsState.activeSpaceId); }} />
{/if}

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
