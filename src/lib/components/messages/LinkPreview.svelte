<script lang="ts">
	import { getUrlPreview, type UrlPreview } from '$lib/matrix/client';
	import Lightbox from '$lib/components/ui/Lightbox.svelte';
	import { favouritesState, isFavouriteGif, addFavouriteGif, removeFavouriteGif } from '$lib/stores/favourites.svelte';
	import { mediaStore } from '$lib/stores/media.svelte';

	interface Props {
		url: string;
	}

	let { url }: Props = $props();

	let preview = $state<UrlPreview | null>(null);
	let imageError = $state(false);
	let lightboxOpen = $state(false);

	type DirectEmbed =
		| { type: 'youtube'; embedUrl: string }
		| { type: 'video'; videoUrl: string };

	let directEmbed = $state<DirectEmbed | null>(null);

	// Reactively track favourite state — isFavouriteGif reads favouritesState.gifs ($state) so this auto-tracks
	const favourited = $derived(isFavouriteGif(url));

	function toggleFavourite(e: MouseEvent) {
		e.stopPropagation();
		if (isFavouriteGif(url)) {
			removeFavouriteGif(url);
		} else if (preview?.imageUrl) {
			addFavouriteGif({ url, previewUrl: preview.imageUrl });
		}
	}

	function getYoutubeEmbedUrl(rawUrl: string): string | null {
		try {
			const u = new URL(rawUrl);
			const h = u.hostname.replace(/^www\./, '');
			if (h === 'youtube.com' || h === 'm.youtube.com') {
				const id = u.searchParams.get('v');
				if (id) return `https://www.youtube.com/embed/${id}`;
			}
			if (h === 'youtu.be') {
				const id = u.pathname.slice(1).split('?')[0];
				if (id) return `https://www.youtube.com/embed/${id}`;
			}
		} catch { /* */ }
		return null;
	}

	function getFixUrl(rawUrl: string): string | null {
		try {
			const u = new URL(rawUrl);
			const h = u.hostname.replace(/^www\./, '');
			if (h === 'x.com' || h === 'twitter.com') { u.hostname = 'fixupx.com'; return u.toString(); }
			if (h === 'instagram.com' || h === 'kkinstagram.com') { u.hostname = 'vxinstagram.com'; return u.toString(); }
		} catch { /* */ }
		return null;
	}

	async function fetchOgTags(fetchUrl: string): Promise<Record<string, string>> {
		const res = await fetch(fetchUrl);
		const html = await res.text();
		const tags: Record<string, string> = {};
		for (const match of html.matchAll(/<meta[^>]+>/gi)) {
			const tag = match[0];
			const prop = tag.match(/property="og:([^"]+)"/i)?.[1];
			const content = tag.match(/content="([^"]*)"/i)?.[1];
			if (prop && content !== undefined) tags[prop] = content;
		}
		return tags;
	}

	$effect(() => {
		const currentUrl = url;
		preview = null;
		imageError = false;
		directEmbed = null;

		const ytUrl = getYoutubeEmbedUrl(currentUrl);
		if (ytUrl) {
			directEmbed = { type: 'youtube', embedUrl: ytUrl };
			return;
		}

		const fixUrl = getFixUrl(currentUrl);
		if (fixUrl) {
			fetchOgTags(fixUrl).then(tags => {
				const videoUrl = tags['video:secure_url'] || tags['video:url'] || tags['video'];
				if (videoUrl) {
					directEmbed = { type: 'video', videoUrl };
				} else {
					// Image-only post — fall back to homeserver preview using the fix URL
					getUrlPreview(fixUrl).then(data => {
						if (data && (data.title || data.imageUrl || data.videoUrl)) preview = data;
					});
				}
			}).catch(() => {
				getUrlPreview(fixUrl).then(data => {
					if (data && (data.title || data.imageUrl || data.videoUrl)) preview = data;
				});
			});
			return;
		}

		getUrlPreview(currentUrl).then((data) => {
			if (data && (data.title || data.imageUrl || data.videoUrl)) {
				preview = data;
			}
		});
	});

	// A "direct media" link is one where the homeserver found no page metadata —
	// just a raw image or video. Render it inline without the card chrome.
	const isDirect = $derived(
		!!preview && !preview.title && !preview.description && !preview.siteName
	);

	// Tenor GIF pages have metadata but should still embed inline.
	const isTenor = $derived.by(() => {
		try { return new URL(url).hostname.endsWith('tenor.com'); }
		catch { return false; }
	});

	const showInline = $derived(isDirect || (isTenor && !!(preview?.videoUrl || preview?.imageUrl)));
</script>

{#if directEmbed?.type === 'youtube'}
	<iframe
		src={directEmbed.embedUrl}
		class="mt-1 w-full max-w-sm aspect-video rounded-lg"
		allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
		allowfullscreen
		title="YouTube video"
	></iframe>
{:else if directEmbed?.type === 'video'}
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		src={directEmbed.videoUrl}
		class="max-w-sm max-h-72 rounded-lg mt-1 block"
		controls
		preload="metadata"
	></video>
{:else if preview}
	{#if showInline && preview.videoUrl}
		<!-- Direct video embed -->
		<div class="relative inline-block group/media mt-1">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				src={preview.videoUrl}
				class="max-w-sm max-h-72 rounded-lg block"
				controls
				preload="metadata"
			></video>
			<button
				onclick={toggleFavourite}
				title={favourited ? 'Remove from favourites' : 'Add to favourites'}
				class="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/media:opacity-100 transition-opacity hover:bg-black/70"
			>
				{#if favourited}
					<svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
					</svg>
				{:else}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
					</svg>
				{/if}
			</button>
		</div>
	{:else if showInline && preview.imageUrl && !imageError}
		<!-- Direct image embed — same style as uploaded images -->
		<div class="relative inline-block group/media mt-1">
			<a href={mediaStore.resolve(preview.imageUrl) ?? preview.imageUrl} target="_blank" rel="noopener noreferrer" onclick={(e) => { e.preventDefault(); lightboxOpen = true; }}>
				<img
					src={mediaStore.resolve(preview.imageUrl)}
					alt=""
					class="max-w-sm max-h-72 rounded-lg object-contain cursor-pointer block"
					loading="lazy"
					onerror={() => (imageError = true)}
				/>
			</a>
			<button
				onclick={toggleFavourite}
				title={favourited ? 'Remove from favourites' : 'Add to favourites'}
				class="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover/media:opacity-100 transition-opacity hover:bg-black/70"
			>
				{#if favourited}
					<svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
					</svg>
				{:else}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
					</svg>
				{/if}
			</button>
		</div>
		{#if lightboxOpen}
			<Lightbox src={mediaStore.resolve(preview.imageUrl) ?? preview.imageUrl} alt="" onClose={() => (lightboxOpen = false)} />
		{/if}
	{:else if !showInline}
		<!-- Regular link preview card -->
		<a
			href={preview.canonicalUrl ?? url}
			target="_blank"
			rel="noopener noreferrer"
			class="flex mt-2 max-w-lg rounded overflow-hidden border border-discord-divider bg-discord-backgroundSecondary hover:bg-discord-messageHover transition-colors no-underline"
		>
			<!-- Left accent bar -->
			<div class="w-1 flex-shrink-0 bg-discord-accent"></div>

			<div class="flex flex-1 min-w-0 flex-col p-3 gap-3">
				<!-- Text content -->
				<div class="flex-1 min-w-0">
					{#if preview.siteName}
						<p class="text-xs text-discord-textMuted mb-0.5 truncate">{preview.siteName}</p>
					{/if}
					{#if preview.title}
						<p class="text-sm font-semibold text-discord-accent leading-snug line-clamp-2">{preview.title}</p>
					{/if}
					{#if preview.description}
						<p class="text-xs text-discord-textSecondary mt-1 leading-relaxed line-clamp-3">{preview.description}</p>
					{/if}
				</div>

				<!-- Preview image -->
				{#if preview.imageUrl && !imageError}
					<img
						src={mediaStore.resolve(preview.imageUrl)}
						alt={preview.title ?? ''}
						onerror={() => (imageError = true)}
						class="max-w-full max-h-72 rounded mt-1 object-contain"
						loading="lazy"
					/>
				{/if}
			</div>
		</a>
	{/if}
{/if}
