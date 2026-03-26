<script lang="ts">
	import type { Room, MatrixEvent } from 'matrix-js-sdk';
	import { getPinnedEventIds, unpinMessage, findEventById, fetchEventById, getMemberName, getMemberAvatar, mxcToHttp, getMyPowerLevel, getRoomPowerLevels } from '$lib/matrix/client';
	import { roomsState } from '$lib/stores/rooms.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import { format } from 'date-fns';

	interface Props {
		room: Room;
		onClose: () => void;
		onJumpTo: (eventId: string) => void;
	}

	let { room, onClose, onJumpTo }: Props = $props();

	const pinnedIds = $derived.by(() => { void roomsState.roomsTick; return getPinnedEventIds(room); });
	let fetchedEvents = $state<MatrixEvent[]>([]);
	let loading = $state(false);

	$effect(() => {
		const ids = pinnedIds;
		loading = true;
		fetchedEvents = [];
		Promise.all(ids.map(async (id) => {
			return findEventById(room, id) ?? await fetchEventById(room.roomId, id);
		})).then((results) => {
			fetchedEvents = results
				.filter((e): e is MatrixEvent => !!e)
				.sort((a, b) => b.getTs() - a.getTs());
			loading = false;
		});
	});

	const pinnedEvents = $derived(fetchedEvents);

	const canPin = $derived.by(() => {
		const myPl = getMyPowerLevel(room);
		const pl = getRoomPowerLevels(room);
		const pinPl = pl.events?.['m.room.pinned_events'] ?? pl.state_default;
		return myPl >= pinPl;
	});

	function excerpt(event: MatrixEvent): string {
		const content = event.getContent();
		return content.body ?? content.msgtype ?? '(message)';
	}
</script>

<div class="w-full h-full flex flex-col bg-discord-backgroundSecondary border-l border-discord-divider">
	<div class="flex items-center gap-2 px-4 py-3 border-b border-discord-divider flex-shrink-0">
		<h3 class="font-semibold text-discord-textPrimary text-sm flex-1">Pinned Messages</h3>
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<button onclick={onClose} class="p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors">
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
		</button>
	</div>

	<div class="flex-1 overflow-y-auto">
		{#if loading}
			<div class="flex justify-center mt-8">
				<div class="w-5 h-5 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
			</div>
		{:else if pinnedEvents.length === 0}
			<p class="text-sm text-discord-textMuted text-center mt-8 px-4">No pinned messages.</p>
		{:else}
			<div class="p-2 space-y-1">
				{#each pinnedEvents as event (event.getId())}
					{@const sender = event.getSender() ?? ''}
					{@const avatarUrl = mxcToHttp(getMemberAvatar(room, sender))}
					{@const name = getMemberName(room, sender)}
					<div class="p-2 rounded-lg hover:bg-discord-messageHover transition-colors group">
						<div class="flex items-center gap-2 mb-1">
							<Avatar src={avatarUrl} {name} size={18} />
							<span class="text-xs font-semibold text-discord-textPrimary truncate">{name}</span>
							<span class="text-xs text-discord-textMuted ml-auto flex-shrink-0">{format(event.getTs(), 'MMM d')}</span>
						</div>
						<p class="text-xs text-discord-textMuted line-clamp-3 break-words">{excerpt(event)}</p>
						<div class="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
								onclick={() => { onJumpTo(event.getId()!); onClose(); }}
								class="text-xs text-discord-accent hover:underline"
							>Jump</button>
							{#if canPin}
								<span class="text-discord-textMuted text-xs">·</span>
								<button
									onclick={() => unpinMessage(room, event.getId()!)}
									class="text-xs text-discord-textMuted hover:text-discord-danger transition-colors"
								>Unpin</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
