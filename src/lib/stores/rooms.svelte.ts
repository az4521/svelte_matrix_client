import type { Room } from 'matrix-js-sdk';
import type { SpaceChildInfo } from '$lib/matrix/client';

const STORAGE_KEY = 'matrix_last_room_by_space';
const HOME_KEY = '__home__';

function loadLastRooms(): Record<string, string> {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
	} catch {
		return {};
	}
}

function saveLastRoom(spaceId: string | null, roomId: string): void {
	const map = loadLastRooms();
	map[spaceId ?? HOME_KEY] = roomId;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function getLastRoom(spaceId: string | null): string | null {
	return loadLastRooms()[spaceId ?? HOME_KEY] ?? null;
}

export const roomsState = $state({
	spaces: [] as Room[],
	orphanRooms: [] as Room[],
	directRooms: [] as Room[],
	activeSpaceId: null as string | null,
	activeRoomId: null as string | null,
	roomsInSpace: [] as Room[],
	spaceHierarchy: [] as SpaceChildInfo[],
	hierarchyLoading: false,
	isLoading: false,
	unreadTick: 0
});

export function bumpUnreadTick(): void {
	roomsState.unreadTick++;
}

export function setActiveSpace(spaceId: string | null): void {
	if (spaceId === roomsState.activeSpaceId) return;
	roomsState.activeSpaceId = spaceId;
	roomsState.activeRoomId = getLastRoom(spaceId);
	roomsState.spaceHierarchy = [];
}

export function setActiveRoom(roomId: string): void {
	roomsState.activeRoomId = roomId;
	saveLastRoom(roomsState.activeSpaceId, roomId);
}

export function getActiveRoom(): Room | undefined {
	const allRooms = [...roomsState.roomsInSpace, ...roomsState.orphanRooms, ...roomsState.directRooms];
	return allRooms.find((r) => r.roomId === roomsState.activeRoomId);
}
