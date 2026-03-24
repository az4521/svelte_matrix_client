<script lang="ts">
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import { getRoomAvatar, leaveRoom } from '$lib/matrix/client';
	import { roomsState, setActiveSpace } from '$lib/stores/rooms.svelte';

	interface Props {
		onHomeClick: () => void;
		onSettingsClick: () => void;
	}

	let { onHomeClick, onSettingsClick }: Props = $props();

	let contextMenu = $state<{ spaceId: string; x: number; y: number } | null>(null);

	function openContextMenu(e: MouseEvent, spaceId: string) {
		e.preventDefault();
		contextMenu = { spaceId, x: e.clientX, y: e.clientY };
	}

	async function handleLeaveSpace(spaceId: string) {
		contextMenu = null;
		try {
			await leaveRoom(spaceId);
			if (roomsState.activeSpaceId === spaceId) setActiveSpace(null);
		} catch (err) {
			console.error('Failed to leave space:', err);
		}
	}
</script>

<nav class="w-[72px] bg-discord-backgroundTertiary flex flex-col items-center py-3 gap-2 overflow-y-auto scrollbar-hide flex-shrink-0">
	<!-- Home button -->
	<button
		onclick={onHomeClick}
		class="group relative w-12 h-12 flex items-center justify-center transition-all duration-200 flex-shrink-0"
		class:rounded-2xl={roomsState.activeSpaceId !== null}
		class:rounded-xl={roomsState.activeSpaceId === null}
		class:bg-discord-accent={roomsState.activeSpaceId === null}
		class:bg-discord-backgroundSecondary={roomsState.activeSpaceId !== null}
		class:hover:rounded-xl={roomsState.activeSpaceId !== null}
		class:hover:bg-discord-accent={roomsState.activeSpaceId !== null}
		title="Home"
	>
		<svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
			<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
		</svg>
		{#if roomsState.activeSpaceId === null}
			<div class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 h-8 bg-white rounded-r-full"></div>
		{/if}
	</button>

	<!-- Separator -->
	<div class="w-8 h-px bg-discord-divider my-1 flex-shrink-0"></div>

	<!-- Space icons -->
	{#each roomsState.spaces as space (space.roomId)}
		{@const isActive = roomsState.activeSpaceId === space.roomId}
		{@const avatarSrc = getRoomAvatar(space)}
		<button
			onclick={() => setActiveSpace(space.roomId)}
			oncontextmenu={(e) => openContextMenu(e, space.roomId)}
			class="group relative w-12 h-12 flex items-center justify-center transition-all duration-200 flex-shrink-0"
			title={space.name || space.roomId}
		>
			<Avatar src={avatarSrc} name={space.name || '?'} size={48} rounded="none" class="{isActive ? 'rounded-xl' : 'rounded-2xl group-hover:rounded-xl'} transition-all duration-200" />
			{#if isActive}
				<div class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 h-8 bg-white rounded-r-full"></div>
			{:else}
				<div class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 h-2 bg-white rounded-r-full opacity-0 group-hover:opacity-100 group-hover:h-5 transition-all duration-200"></div>
			{/if}
		</button>
	{/each}

	{#if roomsState.spaces.length > 0}
		<div class="w-8 h-px bg-discord-divider my-1 flex-shrink-0"></div>
	{/if}

	{#if contextMenu}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-50" onclick={() => contextMenu = null}></div>
		<div
			class="fixed z-50 bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl py-1 min-w-36"
			style="left: {contextMenu.x}px; top: {contextMenu.y}px"
		>
			<button
				onclick={() => handleLeaveSpace(contextMenu!.spaceId)}
				class="w-full text-left px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white transition-colors"
			>Leave Space</button>
		</div>
	{/if}

	<!-- Settings button -->
	<button
		onclick={onSettingsClick}
		class="group w-12 h-12 rounded-2xl flex items-center justify-center bg-discord-backgroundSecondary hover:rounded-xl hover:bg-discord-textPositive transition-all duration-200 flex-shrink-0 mt-auto"
		title="Settings"
	>
		<svg class="w-6 h-6 text-discord-textSecondary group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
	</button>
</nav>
