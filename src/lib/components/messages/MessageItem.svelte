<script lang="ts">
	import type { MatrixEvent, Room } from 'matrix-js-sdk';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import EmojiPicker from '$lib/components/ui/EmojiPicker.svelte';
	import Reactions from '$lib/components/messages/Reactions.svelte';
	import LinkPreview from '$lib/components/messages/LinkPreview.svelte';
	import Lightbox from '$lib/components/ui/Lightbox.svelte';
	import { getMemberName, getMemberAvatar, mxcToHttp, findEventById, sendReaction, sendEdit, deleteMessage } from '$lib/matrix/client';
	import { messagesState, bumpReactionTick } from '$lib/stores/messages.svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { tick } from 'svelte';
	import { format } from 'date-fns';
	import { renderHtml } from '$lib/utils/twemoji';
	import { isFavouriteGif, addFavouriteGif, removeFavouriteGif, favouritesState } from '$lib/stores/favourites.svelte';

	interface Props {
		event: MatrixEvent;
		room: Room;
		showHeader: boolean;
		onReply: (event: MatrixEvent) => void;
		editRequested?: boolean;
		onEditDone?: () => void;
	}

	let { event, room, showHeader, onReply, editRequested = false, onEditDone }: Props = $props();

	let showEmojiPicker = $state(false);
	let confirmingDelete = $state(false);
	let imageLightboxOpen = $state(false);
	let emojiPickerBelow = $state(false);
	let reactionBtnEl: HTMLButtonElement | undefined = $state();
	let isEditing = $state(false);
	let editFromKeyboard = false;
	let editText = $state('');
	let isSavingEdit = $state(false);
	let rootEl: HTMLElement | undefined = $state();
	let editTextareaEl: HTMLTextAreaElement | undefined = $state();

	const reactionTick = $derived(messagesState.reactionTick);
	const eventId = $derived(event.getId() ?? '');
	const isOwnMessage = $derived(event.getSender() === auth.userId);
	const isEdited = $derived.by(() => { reactionTick; return !!event.replacingEvent(); });

	const senderId = $derived(event.getSender() ?? '');
	const displayName = $derived(getMemberName(room, senderId));
	const avatarSrc = $derived(getMemberAvatar(room, senderId, 40));
	const timestamp = $derived(event.getTs());
	const content = $derived.by(() => { reactionTick; return event.getContent(); });
	const eventType = $derived(event.getType());
	const msgtype = $derived(content?.msgtype ?? '');

	// Strip the Matrix reply fallback prefix ("> quoted text\n\n") from body
	const body = $derived(() => {
		const raw: string = content?.body ?? '';
		const inReplyTo = content?.['m.relates_to']?.['m.in_reply_to'];
		if (!inReplyTo) return raw;
		// Fallback quote lines start with "> ", followed by a blank line before the real reply
		const parts = raw.split('\n\n');
		if (parts.length >= 2 && parts[0].startsWith('>')) {
			return parts.slice(1).join('\n\n');
		}
		return raw;
	});

	// Strip <mx-reply>...</mx-reply> from formatted_body so we don't double-render the quote
	const formattedBody = $derived(() => {
		const raw = content?.formatted_body as string | undefined;
		if (!raw) return undefined;
		return raw.replace(/<mx-reply>[\s\S]*?<\/mx-reply>/i, '').trim();
	});

	// Replied-to event, if this is a reply
	const inReplyToId = $derived(
		content?.['m.relates_to']?.['m.in_reply_to']?.event_id as string | undefined
	);
	const replyTarget = $derived(
		inReplyToId ? findEventById(room, inReplyToId) : null
	);
	const replyTargetSender = $derived(
		replyTarget ? getMemberName(room, replyTarget.getSender() ?? '') : null
	);
	const replyTargetBody = $derived(() => {
		if (!replyTarget) return null;
		const c = replyTarget.getContent();
		if (replyTarget.getType() === 'm.room.message') {
			const b: string = c?.body ?? '';
			// Strip nested reply prefix from the quoted message's own body
			const parts = b.split('\n\n');
			if (parts.length >= 2 && parts[0].startsWith('>')) return parts.slice(1).join('\n\n');
			return b;
		}
		return null;
	});

	// Sticker URL
	const stickerHttpUrl = $derived(() => {
		if (eventType !== 'm.sticker') return null;
		return mxcToHttp(content?.url as string, 256);
	});

	// Image conversion
	const imageHttpUrl = $derived(() => {
		if (msgtype !== 'm.image') return null;
		const info = content?.info as { w?: number; h?: number; thumbnail_url?: string } | undefined;
		const w = info?.w ?? 800;
		const h = info?.h ?? 600;
		const thumbnailMxc = info?.thumbnail_url as string | undefined;
		if (thumbnailMxc && (w > 800 || h > 600)) {
			return mxcToHttp(thumbnailMxc, 800) ?? mxcToHttp(content?.url as string, 800);
		}
		return mxcToHttp(content?.url as string, 800);
	});

	// Whether this uploaded image is a GIF (eligible for favouriting)
	const isGif = $derived(
		msgtype === 'm.image' && (
			(content?.info as { mimetype?: string } | undefined)?.mimetype === 'image/gif' ||
			body().toLowerCase().endsWith('.gif')
		)
	);

	// Reactively track whether the current image URL is favourited
	const imageIsFavourited = $derived.by(() => {
		favouritesState.gifs; // track
		const src = imageHttpUrl();
		return !!src && isFavouriteGif(src);
	});

	function toggleImageFavourite(e: MouseEvent) {
		e.stopPropagation();
		const src = imageHttpUrl();
		if (!src) return;
		if (isFavouriteGif(src)) {
			removeFavouriteGif(src);
		} else {
			addFavouriteGif({ url: src, previewUrl: src });
		}
	}

	// Whether this message is a thread reply
	const isThreadReply = $derived(
		content?.['m.relates_to']?.rel_type === 'm.thread'
	);

	// Extract http/https URLs from the plain body for inline media previews
	const linkedUrls = $derived.by(() => {
		if (msgtype !== 'm.text') return [];
		const matches = body().match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
		// Deduplicate while preserving order
		return [...new Set(matches)];
	});

	// True if the body text consists entirely of emoji + whitespace (no other characters)
	const emojiOnly = $derived.by(() => {
		const b = body();
		if (!b.trim()) return false;
		// Strip Unicode emoji, variation selectors, ZWJ, whitespace, and :shortcode: patterns
		const stripped = b
			.replace(/:\w+:/g, '')  // custom emoji shortcodes
			.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]/gu, '');
		return stripped.length === 0;
	});

	function withTwemoji(html: string): string {
		return renderHtml(html, 'twemoji');
	}

	function formatTime(ts: number): string {
		return format(new Date(ts), 'h:mm a');
	}

	$effect(() => {
		if (editRequested) {
			editFromKeyboard = true;
			startEdit();
			tick().then(() => {
				rootEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
				editTextareaEl?.focus();
			});
		}
	});

	function startEdit() {
		editText = body();
		isEditing = true;
	}

	function cancelEdit() {
		isEditing = false;
		editText = '';
		if (editFromKeyboard) { editFromKeyboard = false; onEditDone?.(); }
	}

	async function saveEdit() {
		const trimmed = editText.trim();
		const realEventId = event.getId() ?? '';
		if (!trimmed || !realEventId || isSavingEdit) return;
		isSavingEdit = true;
		try {
			await sendEdit(room.roomId, realEventId, trimmed);
			isEditing = false;
			editText = '';
			bumpReactionTick();
			if (editFromKeyboard) { editFromKeyboard = false; onEditDone?.(); }
		} catch (err) {
			console.error('Failed to edit message:', err);
		} finally {
			isSavingEdit = false;
		}
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
		if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
	}

	function plainToHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\|\|(.+?)\|\|/gs, '<span data-mx-spoiler>$1</span>')
			.replace(/\n/g, '<br>');
	}

	// Svelte action: make [data-mx-spoiler] spans toggle-reveal on click
	function spoilers(node: HTMLElement) {
		function setup() {
			node.querySelectorAll<HTMLElement>('[data-mx-spoiler]').forEach((el) => {
				if (el.dataset.spoilerReady) return;
				el.dataset.spoilerReady = '1';
				el.addEventListener('click', () => el.classList.toggle('revealed'));
			});
		}
		setup();
		const observer = new MutationObserver(setup);
		observer.observe(node, { childList: true, subtree: true });
		return { destroy() { observer.disconnect(); } };
	}

	function sanitize(html: string): string {
		return html
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
			.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
			.replace(/\son\w+="[^"]*"/g, '')
			// Convert mxc:// src attributes to HTTP URLs so browsers can load them
			.replace(/src="(mxc:\/\/[^"]+)"/g, (_match, mxc) => {
				const http = mxcToHttp(mxc, 128);
				return http ? `src="${http}"` : `src=""`;
			});
	}
</script>

{#if showEmojiPicker}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="fixed inset-0 z-40" onclick={() => (showEmojiPicker = false)}></div>
{/if}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={rootEl}
	class="group relative flex gap-3 px-4 py-0.5 hover:bg-discord-messageHover rounded transition-colors"
	class:pt-3={showHeader}
	onmouseleave={() => confirmingDelete = false}
>
	<!-- Avatar column -->
	<div class="w-10 flex-shrink-0 mt-0.5">
		{#if showHeader}
			<Avatar src={avatarSrc} name={displayName} size={40} />
		{/if}
	</div>

	<!-- Content column -->
	<div class="flex-1 min-w-0">
		<!-- Sender + timestamp -->
		{#if showHeader}
			<div class="flex items-baseline gap-2 mb-0.5">
				<span class="font-semibold text-sm text-discord-textPrimary hover:underline cursor-pointer">
					{displayName}
				</span>
				<span class="text-xs text-discord-textMuted">{formatTime(timestamp)}</span>
			</div>
		{/if}

		<!-- Reply quote block -->
		{#if replyTarget && replyTargetSender && replyTargetBody()}
			<div class="flex items-start gap-1 mb-1 cursor-default">
				<div class="w-0.5 bg-discord-textMuted rounded-full self-stretch flex-shrink-0 opacity-60"></div>
				<div class="flex items-center gap-1.5 min-w-0">
					<span class="text-xs font-semibold text-discord-textSecondary flex-shrink-0">
						{replyTargetSender}
					</span>
					<span class="text-xs text-discord-textMuted truncate opacity-80">
						{replyTargetBody()}
					</span>
				</div>
			</div>
		{:else if inReplyToId && !replyTarget}
			<!-- Referenced event not in timeline -->
			<div class="flex items-center gap-1 mb-1 opacity-50">
				<div class="w-0.5 h-4 bg-discord-textMuted rounded-full flex-shrink-0"></div>
				<span class="text-xs text-discord-textMuted italic">Original message not loaded</span>
			</div>
		{/if}

		<!-- Message body -->
		{#if eventType === 'm.sticker'}
			{@const src = stickerHttpUrl()}
			{#if src}
				<img
					{src}
					alt={content?.body ?? 'sticker'}
					class="max-w-48 max-h-48 object-contain mt-1"
					loading="lazy"
				/>
			{/if}
		{:else if msgtype === 'm.image'}
			{@const src = imageHttpUrl()}
			{#if src}
				<div class="relative inline-block group/img mt-1">
					<a href={src} target="_blank" rel="noopener noreferrer" onclick={(e) => { e.preventDefault(); imageLightboxOpen = true; }}>
						<img
							{src}
							alt={body()}
							class="max-w-sm max-h-72 rounded-lg object-contain cursor-pointer block"
							loading="lazy"
						/>
					</a>
					{#if isGif}
						<button
							onclick={toggleImageFavourite}
							title={imageIsFavourited ? 'Remove from favourites' : 'Add to favourites'}
							class="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-black/70"
						>
							{#if imageIsFavourited}
								<svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
									<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
								</svg>
							{/if}
						</button>
					{/if}
				</div>
				{#if imageLightboxOpen}
					<Lightbox {src} alt={body()} onClose={() => (imageLightboxOpen = false)} />
				{/if}
			{:else}
				<span class="text-xs text-discord-textMuted italic">[Image unavailable]</span>
			{/if}
		{:else if msgtype === 'm.file'}
			<div class="flex items-center gap-2 p-3 bg-discord-backgroundSecondary rounded-lg mt-1 max-w-sm">
				<svg class="w-8 h-8 text-discord-accent flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
				</svg>
				<div class="min-w-0">
					<p class="text-discord-textPrimary text-sm font-medium truncate">{body()}</p>
					<p class="text-discord-textMuted text-xs">File attachment</p>
				</div>
			</div>
		{:else}
			{#if isEditing}
				<div class="mt-1">
					<textarea
						bind:this={editTextareaEl}
						bind:value={editText}
						onkeydown={onEditKeydown}
						rows="1"
						class="w-full bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-2 py-1.5 outline-none resize-none focus:ring-1 focus:ring-discord-accent/50"
						style="field-sizing: content; max-height: 200px;"
					></textarea>
					<p class="text-xs text-discord-textMuted mt-1">
						<kbd class="font-mono">Enter</kbd> to save &middot;
						<kbd class="font-mono">Esc</kbd> to cancel
					</p>
					<div class="flex gap-2 mt-1">
						<button
							onclick={saveEdit}
							disabled={isSavingEdit || !editText.trim()}
							class="px-3 py-1 text-xs font-semibold bg-discord-accent hover:bg-discord-accentHover text-white rounded transition-colors disabled:opacity-50"
						>Save</button>
						<button
							onclick={cancelEdit}
							class="px-3 py-1 text-xs font-semibold bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary rounded transition-colors"
						>Cancel</button>
					</div>
				</div>
			{:else}
				<div
					use:spoilers
					class="text-sm text-discord-textPrimary leading-relaxed break-words"
					class:emoji-only={emojiOnly}
				>
					{#if formattedBody()}
						{@html withTwemoji(sanitize(formattedBody()!))}
					{:else}
						{@html withTwemoji(plainToHtml(body()))}
					{/if}
					{#if isEdited}
						<span class="text-xs text-discord-textMuted ml-1">(edited)</span>
					{/if}
				</div>
				{#each linkedUrls as url (url)}
					<LinkPreview {url} />
				{/each}
			{/if}
		{/if}

		<!-- Thread badge -->
		{#if isThreadReply}
			<span class="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs text-discord-textMuted bg-discord-backgroundSecondary border border-discord-divider">
				<svg class="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
					<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
				</svg>
				Thread
			</span>
		{/if}

		<!-- Reactions -->
		<Reactions {eventId} {room} {reactionTick} />

		<!-- Inline timestamp (non-grouped messages, shows on hover) -->
		{#if !showHeader}
			<span class="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-discord-textMuted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none select-none">
				{formatTime(timestamp)}
			</span>
		{/if}
	</div>

	<!-- Hover action bar: always visible when emoji picker is open, otherwise on group-hover -->
	<div class="{showEmojiPicker ? 'flex' : 'hidden group-hover:flex'} absolute right-4 top-0 -translate-y-1/2 items-center gap-1 bg-discord-backgroundSecondary border border-discord-divider rounded-lg px-1 py-0.5 shadow-md z-50">
		{#if isOwnMessage && eventType === 'm.room.message' && msgtype === 'm.text'}
			<button
				onclick={startEdit}
				class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
				title="Edit message"
			>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
					<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
				</svg>
			</button>
		{/if}
		{#if isOwnMessage}
			{#if confirmingDelete}
				<span class="text-xs text-discord-textMuted px-1">Delete?</span>
				<button
					onclick={() => { confirmingDelete = false; deleteMessage(room.roomId, eventId); }}
					class="px-2 py-1 rounded text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors"
				>Yes</button>
				<button
					onclick={() => confirmingDelete = false}
					class="px-2 py-1 rounded text-xs font-semibold text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
				>No</button>
			{:else}
				<button
					onclick={() => confirmingDelete = true}
					class="p-1.5 rounded text-discord-textMuted hover:text-red-400 hover:bg-discord-messageHover transition-colors"
					title="Delete message"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
					</svg>
				</button>
			{/if}
		{/if}
		<!-- Add reaction -->
		<div class="relative">
			<button
				bind:this={reactionBtnEl}
				onclick={() => {
					emojiPickerBelow = (reactionBtnEl?.getBoundingClientRect().top ?? 400) < 400;
					showEmojiPicker = !showEmojiPicker;
				}}
				class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
				title="Add reaction"
			>
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 13.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm2.16-5.12A5.507 5.507 0 0 0 12 8c-2.05 0-3.84 1.12-4.81 2.78-.18.31.06.72.42.72h8.79c.36 0 .6-.41.42-.72-.01 0-.01-.01-.02-.01-.18-.31-.42-.6-.64-.11z"/>
				</svg>
			</button>
			{#if showEmojiPicker}
				<div class={emojiPickerBelow ? 'absolute top-full right-0 mt-1 z-50' : 'absolute bottom-full right-0 mb-1 z-50'}>
					<EmojiPicker
						onSelect={async (emoji) => {
							await sendReaction(room.roomId, eventId, emoji);
							showEmojiPicker = false;
						}}
						onSelectCustom={async (emoji) => {
							await sendReaction(room.roomId, eventId, emoji.mxcUrl);
							showEmojiPicker = false;
						}}
						onClose={() => (showEmojiPicker = false)}
					/>
				</div>
			{/if}
		</div>
		<button
			onclick={() => onReply(event)}
			class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
			title="Reply"
		>
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
				<path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/>
			</svg>
		</button>
		</div>
</div>

<style>
	/* Spoiler tags */
	:global([data-mx-spoiler]) {
		background-color: #2a2a2a;
		color: transparent;
		border-radius: 3px;
		padding: 0 3px;
		cursor: pointer;
		user-select: none;
		transition: color 0.15s, background-color 0.15s;
	}
	:global([data-mx-spoiler].revealed) {
		background-color: rgba(255, 255, 255, 0.1);
		color: inherit;
		user-select: text;
	}

	/* Twemoji images inline in text */
	:global(.twemoji) {
		height: 1.25em;
		width: 1.25em;
		vertical-align: -0.25em;
		display: inline-block;
		object-fit: contain;
	}

	/* Larger emoji when the message is emoji-only */
	:global(.emoji-only .twemoji) {
		height: 36px;
		width: 36px;
		vertical-align: -0.4em;
	}

	/* Custom emoji (data-mx-emoticon) inline size */
	:global([data-mx-emoticon]) {
		height: 1.25em;
		width: auto;
		vertical-align: -0.25em;
		display: inline-block;
		object-fit: contain;
	}

	:global(.emoji-only [data-mx-emoticon]) {
		height: 36px;
		width: auto;
		vertical-align: -0.4em;
	}
</style>
