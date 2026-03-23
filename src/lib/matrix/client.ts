import { createClient, ClientEvent, RoomEvent, RoomMemberEvent, PendingEventOrdering, EventStatus } from 'matrix-js-sdk';
import type { MatrixClient, Room, MatrixEvent, RoomMember } from 'matrix-js-sdk';

let matrixClient: MatrixClient | null = null;

export function getClient(): MatrixClient | null {
	return matrixClient;
}

async function resolveHomeserver(input: string): Promise<string> {
	const normalized = input.trim().replace(/\/$/, '');
	const withProtocol = normalized.startsWith('http') ? normalized : `https://${normalized}`;
	try {
		const res = await fetch(`${withProtocol}/.well-known/matrix/client`);
		if (res.ok) {
			const data = await res.json();
			const baseUrl: string | undefined = data?.['m.homeserver']?.['base_url'];
			if (baseUrl) return baseUrl.replace(/\/$/, '');
		}
	} catch {
		// .well-known not available, use input as-is
	}
	return withProtocol;
}

export async function login(
	homeserverUrl: string,
	username: string,
	password: string
): Promise<{ userId: string; accessToken: string; deviceId: string; homeserverUrl: string }> {
	const resolvedBase = await resolveHomeserver(homeserverUrl);
	const tempClient = createClient({ baseUrl: resolvedBase });

	const response = await tempClient.login('m.login.password', {
		user: username,
		password: password,
		initial_device_display_name: 'Matrix Svelte Client'
	});

	const resolvedURL = tempClient.getHomeserverUrl();

	tempClient.stopClient();

	matrixClient = createClient({
		baseUrl: resolvedURL,
		accessToken: response.access_token,
		userId: response.user_id,
		deviceId: response.device_id,
	});

	return {
		userId: response.user_id,
		accessToken: response.access_token!,
		deviceId: response.device_id!,
		homeserverUrl: resolvedURL
	};
}

export function reconnect(
	homeserverUrl: string,
	userId: string,
	accessToken: string,
	deviceId: string
): void {
	matrixClient = createClient({
		baseUrl: homeserverUrl,
		accessToken,
		userId,
		deviceId
	});
}

export function startSync(onStateChange: (state: string) => void): void {
	if (!matrixClient) throw new Error('Not logged in');

	matrixClient.on(ClientEvent.Sync, (state) => {
		onStateChange(state as string);
	});

	matrixClient.startClient({ initialSyncLimit: 100, pendingEventOrdering: PendingEventOrdering.Detached });
}

const FAV_GIFS_KEY = 'm.favourite_gifs';

export interface FavouriteGif {
	url: string;
	previewUrl: string;
	addedAt: number;
}

export function loadFavouriteGifs(): FavouriteGif[] {
	if (!matrixClient) return [];
	const event = matrixClient.getAccountData(FAV_GIFS_KEY);
	return (event?.getContent()?.gifs as FavouriteGif[] | undefined) ?? [];
}

export async function persistFavouriteGifs(gifs: FavouriteGif[]): Promise<void> {
	if (!matrixClient) return;
	await matrixClient.setAccountData(FAV_GIFS_KEY, { gifs });
}

export function onAccountData(callback: (type: string) => void): () => void {
	if (!matrixClient) return () => {};
	const handler = (event: MatrixEvent) => callback(event.getType());
	matrixClient.on(ClientEvent.AccountData, handler as never);
	return () => matrixClient?.off(ClientEvent.AccountData, handler as never);
}

export function onSyncPrepared(callback: () => void): () => void {
	if (!matrixClient) return () => {};
	const handler = (state: string) => {
		if (state === 'PREPARED') callback();
	};
	matrixClient.on(ClientEvent.Sync, handler as never);
	return () => matrixClient?.off(ClientEvent.Sync, handler as never);
}

export async function logout(): Promise<void> {
	if (matrixClient) {
		try {
			await matrixClient.logout(true);
		} catch {
			// ignore errors on logout
		}
		matrixClient.stopClient();
		matrixClient = null;
	}
}

export function stopClient(): void {
	matrixClient?.stopClient();
	matrixClient = null;
}

export function getRooms(): Room[] {
	return matrixClient?.getRooms() ?? [];
}

export function getRoom(roomId: string): Room | null {
	return matrixClient?.getRoom(roomId) ?? null;
}


export function getSpaces(): Room[] {
	return getRooms().filter((r) => r.isSpaceRoom());
}

export function getSpaceChildIds(spaceId: string): string[] {
	const space = matrixClient?.getRoom(spaceId);
	if (!space) return [];

	const events = space.currentState.getStateEvents('m.space.child');
	const arr = Array.isArray(events) ? events : events ? [events] : [];

	return arr
		.filter((e) => {
			const content = e.getContent();
			return content?.via?.length > 0;
		})
		.sort((a, b) => {
			const ao: string | undefined = a.getContent()?.order;
			const bo: string | undefined = b.getContent()?.order;
			if (ao !== undefined && bo !== undefined) return ao < bo ? -1 : ao > bo ? 1 : 0;
			if (ao !== undefined) return -1;
			if (bo !== undefined) return 1;
			// Both lack order: sort by room ID for stability
			return (a.getStateKey() ?? '') < (b.getStateKey() ?? '') ? -1 : 1;
		})
		.map((e) => e.getStateKey()!)
		.filter(Boolean);
}

export function getRoomsInSpace(spaceId: string): Room[] {
	const childIds = getSpaceChildIds(spaceId);
	return childIds
		.map((id) => matrixClient?.getRoom(id))
		.filter((r): r is Room => !!r && !r.isSpaceRoom());
}

export function getDirectRoomIds(): Set<string> {
	const directEvent = matrixClient?.getAccountData('m.direct');
	if (!directEvent) return new Set();
	const content = directEvent.getContent() as Record<string, string[]>;
	return new Set(Object.values(content).flat());
}

export function getOrphanRooms(): Room[] {
	const allSpaceChildIds = new Set<string>();
	getSpaces().forEach((space) => {
		getSpaceChildIds(space.roomId).forEach((id) => allSpaceChildIds.add(id));
	});

	const directIds = getDirectRoomIds();

	return getRooms().filter(
		(r) => !r.isSpaceRoom() && !allSpaceChildIds.has(r.roomId) && !directIds.has(r.roomId)
	);
}

export function getDirectRooms(): Room[] {
	const directIds = getDirectRoomIds();
	return getRooms().filter((r) => directIds.has(r.roomId) && !r.isSpaceRoom());
}

export function getTimelineMessages(room: Room): MatrixEvent[] {
	const filter = (e: MatrixEvent) => {
		if (e.isRedacted()) return false;
		if (e.getType() !== 'm.room.message' && e.getType() !== 'm.sticker') return false;
		const rel = e.getContent()?.['m.relates_to'];
		if (rel?.rel_type === 'm.replace') return false;
		return true;
	};
	const timeline = room.getLiveTimeline().getEvents().filter(filter);
	// Include pending (local echo) events but skip failed sends
	const pending = room.getPendingEvents().filter(
		(e) => filter(e) && e.status !== EventStatus.NOT_SENT && e.status !== EventStatus.CANCELLED
	);
	return [...timeline, ...pending];
}


export async function sendFile(roomId: string, file: File): Promise<void> {
	if (!matrixClient) throw new Error('Not logged in');
	const { content_uri } = await matrixClient.uploadContent(file, { name: file.name });
	const isImage = file.type.startsWith('image/');
	const isVideo = file.type.startsWith('video/');
	const isAudio = file.type.startsWith('audio/');
	const msgtype = isImage ? 'm.image' : isVideo ? 'm.video' : isAudio ? 'm.audio' : 'm.file';
	await matrixClient.sendMessage(roomId, {
		msgtype,
		body: file.name,
		url: content_uri,
		info: { mimetype: file.type, size: file.size }
	} as never);
}

export async function sendTextMessage(roomId: string, text: string): Promise<void> {
	if (!matrixClient) throw new Error('Not logged in');
	await matrixClient.sendTextMessage(roomId, text);
}

export async function sendFormattedMessage(
	roomId: string,
	body: string,
	formattedBody: string
): Promise<void> {
	if (!matrixClient) throw new Error('Not logged in');
	await matrixClient.sendMessage(roomId, {
		msgtype: 'm.text',
		body,
		format: 'org.matrix.custom.html',
		formatted_body: formattedBody
	} as never);
}

export function mxcToHttp(mxcUrl: string | null | undefined, size = 0): string | null {
	if (!matrixClient || !mxcUrl?.startsWith('mxc://')) return null;
	const match = mxcUrl.match(/^mxc:\/\/([^/]+)\/(.+)$/);
	if (!match) return null;
	const [, serverName, mediaId] = match;
	const baseUrl = matrixClient.getHomeserverUrl();
	if (size > 0) {
		return `${baseUrl}/_matrix/client/v1/media/thumbnail/${serverName}/${mediaId}?width=${size}&height=${size}&method=crop`;
	}
	return `${baseUrl}/_matrix/client/v1/media/download/${serverName}/${mediaId}`;
}

/** HEAD-request a URL (with auth for homeserver URLs) and return its Content-Type. */
export async function getContentType(url: string): Promise<string | null> {
	if (!matrixClient) return null;
	const accessToken = matrixClient.getAccessToken();
	const baseUrl = matrixClient.getHomeserverUrl();
	const headers: Record<string, string> = {};
	if (accessToken && url.startsWith(baseUrl)) {
		headers.Authorization = `Bearer ${accessToken}`;
	}
	try {
		const res = await fetch(url, { method: 'HEAD', headers });
		return res.ok ? res.headers.get('content-type') : null;
	} catch {
		return null;
	}
}

/** Fetch a URL with the Matrix Authorization header for homeserver media URLs. */
export async function fetchMediaWithAuth(url: string): Promise<string | null> {
	if (!matrixClient) return null;
	const accessToken = matrixClient.getAccessToken();
	const baseUrl = matrixClient.getHomeserverUrl();
	const headers: Record<string, string> = {};
	if (accessToken && url.startsWith(baseUrl)) {
		headers.Authorization = `Bearer ${accessToken}`;
	}
	try {
		const res = await fetch(url, { headers });
		if (!res.ok) return null;
		const blob = await res.blob();
		return URL.createObjectURL(blob);
	} catch {
		return null;
	}
}

export interface UrlPreview {
	title?: string;
	description?: string;
	imageUrl?: string;
	imageWidth?: number;
	imageHeight?: number;
	videoUrl?: string;
	siteName?: string;
	canonicalUrl?: string;
	/** MIME type or og:type returned by the homeserver preview (e.g. "video/mp4") */
	contentType?: string;
}

/** Returns the raw homeserver URL preview response object, useful for debugging. */
export async function getRawUrlPreview(url: string): Promise<Record<string, unknown> | null> {
	if (!matrixClient) return null;
	try {
		return await matrixClient.getUrlPreview(url, Date.now()) as Record<string, unknown>;
	} catch (e) {
		return { error: String(e) };
	}
}

export async function getUrlPreview(url: string): Promise<UrlPreview | null> {
	if (!matrixClient) return null;
	try {
		const data = await matrixClient.getUrlPreview(url, Date.now());
		const ogImage = data['og:image'] as string | undefined;
		const imageUrl = ogImage?.startsWith('mxc://') ? mxcToHttp(ogImage) ?? undefined : ogImage;
		const rawVideo = (data['og:video:secure_url'] ?? data['og:video:url'] ?? data['og:video']) as string | undefined;
		const videoUrl = rawVideo?.startsWith('mxc://') ? mxcToHttp(rawVideo) ?? undefined : rawVideo;
		return {
			title: data['og:title'] as string | undefined,
			description: data['og:description'] as string | undefined,
			imageUrl,
			imageWidth: data['og:image:width'] as number | undefined,
			imageHeight: data['og:image:height'] as number | undefined,
			videoUrl,
			siteName: data['og:site_name'] as string | undefined,
			canonicalUrl: (data['og:url'] as string | undefined) ?? url,
			contentType: data['og:type'] as string | undefined,
		};
	} catch {
		return null;
	}
}

export function getOwnUserId(): string | null {
	return matrixClient?.getUserId() ?? null;
}

export function getOwnAvatarUrl(): string | null {
	const userId = matrixClient?.getUserId();
	if (!userId) return null;
	const mxc = matrixClient?.getUser(userId)?.avatarUrl;
	return mxcToHttp(mxc);
}

export function getRoomDisplayName(room: Room): string {
	return room.name || room.roomId;
}

export function getMemberName(room: Room, userId: string): string {
	return room.getMember(userId)?.name || userId;
}

export function getMemberAvatar(room: Room, userId: string): string | null {
	const mxc = room.getMember(userId)?.getMxcAvatarUrl();
	return mxcToHttp(mxc);
}

export function getRoomMembers(room: Room): RoomMember[] {
	return room.getMembers().filter((m) => m.membership === 'join');
}

export function getRoomTopic(room: Room): string | null {
	const topicEvent = room.currentState.getStateEvents('m.room.topic', '');
	return topicEvent?.getContent()?.topic || null;
}

export function getRoomAvatar(room: Room): string | null {
	const avatarEvent = room.currentState.getStateEvents('m.room.avatar', '');
	const mxc = avatarEvent?.getContent()?.url;
	return mxcToHttp(mxc);
}

export function getUnreadCount(room: Room): number {
	return room.getUnreadNotificationCount() ?? 0;
}

export function onTimelineEvent(
	callback: (event: MatrixEvent, room: Room) => void
): () => void {
	if (!matrixClient) return () => {};
	const handler = (event: MatrixEvent, room: Room | undefined) => {
		const isReplacement = event.getContent()?.['m.relates_to']?.rel_type === 'm.replace';
		if (room && !isReplacement && (event.getType() === 'm.room.message' || event.getType() === 'm.sticker') && !event.isRedacted()) {
			callback(event, room);
		}
	};
	matrixClient.on(RoomEvent.Timeline, handler as never);
	return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

export function onLocalEchoUpdated(callback: (room: Room) => void): () => void {
	if (!matrixClient) return () => {};
	const handler = (_event: MatrixEvent, room: Room | undefined) => {
		if (room) callback(room);
	};
	matrixClient.on(RoomEvent.LocalEchoUpdated, handler as never);
	return () => matrixClient?.off(RoomEvent.LocalEchoUpdated, handler as never);
}

export function onEditEvent(callback: (event: MatrixEvent, room: Room) => void): () => void {
	if (!matrixClient) return () => {};
	const handler = (event: MatrixEvent, room: Room | undefined) => {
		if (room && event.getType() === 'm.room.message' &&
			event.getContent()?.['m.relates_to']?.rel_type === 'm.replace') {
			callback(event, room);
		}
	};
	matrixClient.on(RoomEvent.Timeline, handler as never);
	return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

export async function sendEdit(roomId: string, eventId: string, newText: string): Promise<void> {
	if (!matrixClient) throw new Error('Not logged in');
	await matrixClient.sendEvent(roomId, 'm.room.message' as never, {
		msgtype: 'm.text',
		body: `* ${newText}`,
		'm.new_content': { msgtype: 'm.text', body: newText },
		'm.relates_to': { rel_type: 'm.replace', event_id: eventId }
	} as never);
}

export function onRoomUpdate(callback: () => void): () => void {
	if (!matrixClient) return () => {};
	matrixClient.on('Room' as never, callback as never);
	matrixClient.on('Room.name' as never, callback as never);
	return () => {
		matrixClient?.off('Room' as never, callback as never);
		matrixClient?.off('Room.name' as never, callback as never);
	};
}

export async function loadPreviousMessages(room: Room): Promise<boolean> {
	if (!matrixClient) return false;
	const before = room.getLiveTimeline().getEvents().length;
	await matrixClient.scrollback(room, 30);
	const after = room.getLiveTimeline().getEvents().length;
	return after > before;
}

export async function sendReadReceipt(event: MatrixEvent): Promise<void> {
	if (!matrixClient) return;
	await matrixClient.sendReadReceipt(event);
}

export async function sendTyping(roomId: string, isTyping: boolean): Promise<void> {
	if (!matrixClient) return;
	try {
		await matrixClient.sendTyping(roomId, isTyping, 5000);
	} catch {
		// ignore typing errors
	}
}

export function onTypingEvent(room: Room, callback: (userIds: string[]) => void): () => void {
	if (!matrixClient) return () => {};
	const myId = matrixClient.getUserId();
	const handler = (_event: unknown, member: RoomMember) => {
		if (member.roomId !== room.roomId) return;
		const typing = room.getMembers().filter((m) => m.typing && m.userId !== myId).map((m) => m.userId);
		callback(typing);
	};
	matrixClient.on(RoomMemberEvent.Typing as never, handler as never);
	return () => matrixClient?.off(RoomMemberEvent.Typing as never, handler as never);
}

export interface SpaceChildInfo {
	roomId: string;
	name: string;
	topic?: string;
	avatarUrl?: string;
	numMembers: number;
	isJoined: boolean;
}

export async function fetchSpaceHierarchy(spaceId: string): Promise<SpaceChildInfo[]> {
	if (!matrixClient) return [];
	try {
		// depth 1 = direct children only; limit 200 rooms
		const result = await (matrixClient as unknown as Record<string, Function>)['getRoomHierarchy'](
			spaceId,
			200,
			1
		) as { rooms: Array<Record<string, unknown>> };

		const joinedIds = new Set(matrixClient.getRooms().map((r) => r.roomId));

		return result.rooms
			.filter((r) => r['room_id'] !== spaceId)
			.filter((r) => r['room_type'] !== 'm.space')
			.map((r) => {
				const mxcAvatar = r['avatar_url'] as string | undefined;
				return {
					roomId: r['room_id'] as string,
					name: (r['name'] as string) || (r['room_id'] as string),
					topic: r['topic'] as string | undefined,
					avatarUrl: mxcAvatar ? mxcToHttp(mxcAvatar) ?? undefined : undefined,
					numMembers: (r['num_joined_members'] as number) ?? 0,
					isJoined: joinedIds.has(r['room_id'] as string)
				};
			});
	} catch (err) {
		console.error('Failed to fetch space hierarchy:', err);
		return [];
	}
}

export async function joinRoom(roomId: string): Promise<void> {
	if (!matrixClient) throw new Error('Not logged in');
	await matrixClient.joinRoom(roomId);
}

export interface ReactionGroup {
	key: string;
	count: number;
	isMine: boolean;        // true even while local echo is pending
	myEventId: string | null; // only set once server-confirmed (used for removal)
}

export function getReactions(room: Room, eventId: string): ReactionGroup[] {
	if (!matrixClient) return [];
	try {
		const relations = room.relations.getChildEventsForEvent(eventId, 'm.annotation', 'm.reaction');
		if (!relations) return [];

		const ownUserId = matrixClient.getUserId();
		const groups: Map<string, { count: number; isMine: boolean; myEventId: string | null }> = new Map();

		for (const e of relations.getRelations()) {
			if (e.isRedacted()) continue;
			const key: string = e.getContent()?.['m.relates_to']?.key ?? '';
			if (!key) continue;
			const existing = groups.get(key) ?? { count: 0, isMine: false, myEventId: null };
			const isOwn = e.getSender() === ownUserId;
			groups.set(key, {
				count: existing.count + 1,
				isMine: existing.isMine || isOwn,
				myEventId: isOwn && !e.status ? (e.getId() ?? null) : existing.myEventId
			});
		}

		return Array.from(groups.entries()).map(([key, { count, isMine, myEventId }]) => ({
			key,
			count,
			isMine,
			myEventId
		}));
	} catch {
		return [];
	}
}

export async function sendReaction(roomId: string, eventId: string, key: string): Promise<void> {
	if (!matrixClient) throw new Error('Not logged in');
	// Deduplicate: don't send if user already has this reaction (including local echoes)
	const room = matrixClient.getRoom(roomId);
	if (room) {
		const existing = getReactions(room, eventId);
		if (existing.some((g) => g.key === key && g.isMine)) return;
	}
	await matrixClient.sendEvent(roomId, 'm.reaction' as never, {
		'm.relates_to': {
			rel_type: 'm.annotation',
			event_id: eventId,
			key
		}
	} as never);
}

export async function removeReaction(roomId: string, reactionEventId: string): Promise<void> {
	if (!matrixClient) throw new Error('Not logged in');
	await matrixClient.redactEvent(roomId, reactionEventId);
}

export async function deleteMessage(roomId: string, eventId: string): Promise<void> {
	if (!matrixClient) throw new Error('Not logged in');
	await matrixClient.redactEvent(roomId, eventId);
}

export interface CustomEmoji {
	shortcode: string;
	mxcUrl: string; // mxc:// url (used in formatted_body so other clients can proxy it)
	url: string;    // http url (used for display in our own picker)
}

export interface CustomEmojiPack {
	id: string;       // 'user' or a room ID
	name: string;
	avatarUrl?: string; // http avatar URL for space packs
	emojis: CustomEmoji[];
}

// Sticker types mirror emoji types
export type CustomSticker = CustomEmoji;
export interface CustomStickerPack {
	id: string;
	name: string;
	avatarUrl?: string;
	stickers: CustomSticker[];
}

type ImageUsage = 'emoticon' | 'sticker';

// Effective usage: image-level overrides pack-level; absent at both levels means both kinds.
function matchesUsage(imageUsage: string[] | undefined, packUsage: string[] | undefined, kind: ImageUsage): boolean {
	const effective = (imageUsage && imageUsage.length > 0) ? imageUsage : packUsage;
	if (!effective || effective.length === 0) return true;
	return effective.includes(kind);
}

function extractRoomImages(room: Room, kind: ImageUsage): CustomEmoji[] {
	try {
		const events = room.currentState.getStateEvents('im.ponies.room_emotes');
		const seen = new Set<string>();
		return events.flatMap((event) => {
			const content = event.getContent();
			const images = content?.images as Record<string, { url?: string; usage?: string[] }> | undefined;
			if (!images) return [];
			const packUsage = (content?.pack as { usage?: string[] } | undefined)?.usage;
			return Object.entries(images)
				.filter(([shortcode, data]) =>
					data?.url?.startsWith('mxc://') && !seen.has(shortcode) && matchesUsage(data.usage, packUsage, kind))
				.flatMap(([shortcode, data]) => {
					seen.add(shortcode);
					const http = mxcToHttp(data.url!);
					return http ? [{ shortcode, mxcUrl: data.url!, url: http }] : [];
				});
		});
	} catch {
		return [];
	}
}

function extractRoomEmojis(room: Room): CustomEmoji[] { return extractRoomImages(room, 'emoticon'); }
function extractRoomStickers(room: Room): CustomSticker[] { return extractRoomImages(room, 'sticker'); }

function getUserPackImages(kind: ImageUsage): CustomEmoji[] {
	if (!matrixClient) return [];
	try {
		const accountData = matrixClient.getAccountData('im.ponies.user_emotes');
		if (!accountData) return [];
		const content = accountData.getContent();
		const images = content?.images as Record<string, { url?: string; usage?: string[] }> | undefined;
		if (!images) return [];
		const packUsage = (content?.pack as { usage?: string[] } | undefined)?.usage;
		return Object.entries(images)
			.filter(([, data]) => data?.url?.startsWith('mxc://') && matchesUsage(data.usage, packUsage, kind))
			.flatMap(([shortcode, data]) => {
				const http = mxcToHttp(data.url!);
				return http ? [{ shortcode, mxcUrl: data.url!, url: http }] : [];
			});
	} catch { return []; }
}

// Returns custom emoji packs (emoticons only): user pack first, then active space.
export function getCustomEmojiPacks(activeSpaceId: string | null, spaces: Room[]): CustomEmojiPack[] {
	if (!matrixClient) return [];
	const packs: CustomEmojiPack[] = [];

	const userEmojis = getUserPackImages('emoticon');
	if (userEmojis.length > 0) packs.push({ id: 'user', name: 'My Emojis', emojis: userEmojis });

	if (activeSpaceId) {
		const spaceRoom = matrixClient.getRoom(activeSpaceId);
		if (spaceRoom) {
			const emojis = extractRoomEmojis(spaceRoom);
			if (emojis.length > 0) {
				const avatarUrl = getRoomAvatar(spaceRoom) ?? undefined;
				packs.push({ id: activeSpaceId, name: spaceRoom.name || 'Space', avatarUrl, emojis });
			}
		}
	}

	return packs;
}

// Returns custom sticker packs: user pack first, then active space.
export function getCustomStickerPacks(activeSpaceId: string | null): CustomStickerPack[] {
	if (!matrixClient) return [];
	const packs: CustomStickerPack[] = [];

	const userStickers = getUserPackImages('sticker');
	if (userStickers.length > 0) packs.push({ id: 'user', name: 'My Stickers', stickers: userStickers });

	if (activeSpaceId) {
		const spaceRoom = matrixClient.getRoom(activeSpaceId);
		if (spaceRoom) {
			const stickers = extractRoomStickers(spaceRoom);
			if (stickers.length > 0) {
				const avatarUrl = getRoomAvatar(spaceRoom) ?? undefined;
				packs.push({ id: activeSpaceId, name: spaceRoom.name || 'Space', avatarUrl, stickers });
			}
		}
	}

	return packs;
}

// Flat list of all custom emojis (emoticons only) — used at send time to resolve shortcodes.
export function getCustomEmojis(room?: Room, activeSpaceId?: string | null): CustomEmoji[] {
	if (!matrixClient) return [];
	const seen = new Set<string>();
	const result: CustomEmoji[] = [];
	const add = (emojis: CustomEmoji[]) => {
		for (const e of emojis) {
			if (!seen.has(e.shortcode)) { seen.add(e.shortcode); result.push(e); }
		}
	};

	add(getUserPackImages('emoticon'));
	if (room) add(extractRoomEmojis(room));
	if (activeSpaceId) {
		const spaceRoom = matrixClient.getRoom(activeSpaceId);
		if (spaceRoom) add(extractRoomEmojis(spaceRoom));
	}

	return result;
}

export async function sendSticker(roomId: string, sticker: CustomSticker): Promise<void> {
	if (!matrixClient) throw new Error('Not connected');
	await matrixClient.sendEvent(roomId, 'm.sticker' as any, {
		body: sticker.shortcode,
		url: sticker.mxcUrl,
		info: {}
	});
}

export function onReactionEvent(callback: (event: MatrixEvent, room: Room) => void): () => void {
	if (!matrixClient) return () => {};
	const handler = (event: MatrixEvent, room: Room | undefined) => {
		if (room && event.getType() === 'm.reaction') {
			callback(event, room);
		}
	};
	matrixClient.on(RoomEvent.Timeline, handler as never);
	return () => matrixClient?.off(RoomEvent.Timeline, handler as never);
}

export function onRedactionEvent(room: Room, callback: (event: MatrixEvent, room: Room) => void): () => void {
	const handler = (event: MatrixEvent, r: Room) => callback(event, r);
	room.on(RoomEvent.Redaction as never, handler as never);
	return () => room.off(RoomEvent.Redaction as never, handler as never);
}

export function findEventById(room: Room, eventId: string): MatrixEvent | null {
	// Search the live timeline first, then any other timeline windows
	const timelineSet = room.getUnfilteredTimelineSet();
	return timelineSet.findEventById(eventId) ?? null;
}

export async function sendReply(
	roomId: string,
	text: string,
	replyToEvent: MatrixEvent
): Promise<void> {
	if (!matrixClient) throw new Error('Not logged in');

	const replyEventId = replyToEvent.getId()!;
	const replySender = replyToEvent.getSender() ?? '';
	const replyContent = replyToEvent.getContent();
	const replyBody: string = replyContent?.body ?? '';

	// Matrix reply fallback: prefix each line of the original with "> "
	const quotedLines = replyBody
		.split('\n')
		.map((l: string) => `> ${l}`)
		.join('\n');
	const fallbackBody = `> <${replySender}> ${quotedLines}\n\n${text}`;

	// HTML reply block per Matrix spec
	const replyHtml = replyContent?.formatted_body ?? replyBody;
	const formattedQuote =
		`<mx-reply><blockquote>` +
		`<a href="https://matrix.to/#/${replyToEvent.getRoomId()}/${replyEventId}">In reply to</a> ` +
		`<a href="https://matrix.to/#/${replySender}">${replySender}</a><br>${replyHtml}` +
		`</blockquote></mx-reply>`;

	await matrixClient.sendMessage(roomId, {
		msgtype: 'm.text',
		body: fallbackBody,
		format: 'org.matrix.custom.html',
		formatted_body: formattedQuote + text,
		'm.relates_to': {
			'm.in_reply_to': { event_id: replyEventId }
		}
	} as never);
}
