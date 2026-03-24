import type { Room } from 'matrix-js-sdk';
import type { SpaceChildInfo } from '$lib/matrix/client';

const STORAGE_KEY = 'matrix_last_room_by_space';
const SPACE_KEY = 'matrix_last_space';
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

function loadLastSpace(): string | null {
	return localStorage.getItem(SPACE_KEY);
}

function saveLastSpace(spaceId: string | null): void {
	if (spaceId === null) {
		localStorage.removeItem(SPACE_KEY);
	} else {
		localStorage.setItem(SPACE_KEY, spaceId);
	}
}

export const roomsState = $state({
	spaces: [] as Room[],
	orphanRooms: [] as Room[],
	directRooms: [] as Room[],
	invitedRooms: [] as Room[],
	activeSpaceId: loadLastSpace() as string | null,
	activeRoomId: getLastRoom(loadLastSpace()) as string | null,
	roomsInSpace: [] as Room[],
	spaceHierarchy: [] as SpaceChildInfo[],
	hierarchyLoading: false,
	isLoading: false,
	unreadTick: 0,
	roomsTick: 0
});

export function bumpUnreadTick(): void {
	roomsState.unreadTick++;
}

export function setActiveSpace(spaceId: string | null): void {
	if (spaceId === roomsState.activeSpaceId) return;
	roomsState.activeSpaceId = spaceId;
	roomsState.activeRoomId = getLastRoom(spaceId);
	roomsState.spaceHierarchy = [];
	saveLastSpace(spaceId);
}

export function setActiveRoom(roomId: string): void {
	roomsState.activeRoomId = roomId;
	saveLastRoom(roomsState.activeSpaceId, roomId);
}

export function getActiveRoom(): Room | undefined {
	const allRooms = [...roomsState.roomsInSpace, ...roomsState.orphanRooms, ...roomsState.directRooms];
	return allRooms.find((r) => r.roomId === roomsState.activeRoomId);
}
