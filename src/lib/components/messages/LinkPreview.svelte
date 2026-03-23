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

	interface TweetEmbed {
		authorName: string;
		authorHandle: string;
		text: string;
		photos: string[];
		videos: string[];
	}

	let tweetEmbed = $state<TweetEmbed | null>(null);
	let lightboxTweetIndex = $state<number | null>(null);

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

	function getTwitterApiUrl(rawUrl: string): string | null {
		try {
			const u = new URL(rawUrl);
			const h = u.hostname.replace(/^www\./, '');
			if (h !== 'x.com' && h !== 'twitter.com') return null;
			// Path: /{user}/status/{id}
			const m = u.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
			if (!m) return null;
			return `https://api.fxtwitter.com/${m[1]}/status/${m[2]}`;
		} catch { /* */ }
		return null;
	}

	function getInstagramFixUrl(rawUrl: string): string | null {
		try {
			const u = new URL(rawUrl);
			const h = u.hostname.replace(/^www\./, '');
			if (h === 'instagram.com' || h === 'kkinstagram.com') { u.hostname = 'vxinstagram.com'; return u.toString(); }
		} catch { /* */ }
		return null;
	}

	$effect(() => {
		const currentUrl = url;
		preview = null;
		imageError = false;
		directEmbed = null;
		tweetEmbed = null;

		const ytUrl = getYoutubeEmbedUrl(currentUrl);
		if (ytUrl) {
			directEmbed = { type: 'youtube', embedUrl: ytUrl };
			return;
		}

		// Twitter/X: use fxtwitter JSON API (has CORS headers)
		const twitterApiUrl = getTwitterApiUrl(currentUrl);
		if (twitterApiUrl) {
			fetch(twitterApiUrl, { headers: { Accept: 'application/json' } })
				.then(r => r.json())
				.then((data: any) => {
					const tweet = data?.tweet;
					if (!tweet) return;
					tweetEmbed = {
						authorName: tweet.author?.name ?? '',
						authorHandle: tweet.author?.screen_name ?? '',
						text: tweet.text ?? '',
						photos: (tweet.media?.photos ?? []).map((p: any) => p.url as string),
						videos: (tweet.media?.videos ?? []).map((v: any) => v.url as string),
					};
				});
			return;
		}

		// Instagram: no CORS-friendly API — use homeserver preview via vxinstagram
		const igFixUrl = getInstagramFixUrl(currentUrl);
		if (igFixUrl) {
			getUrlPreview(igFixUrl).then(data => {
				if (data && (data.title || data.imageUrl)) preview = data;
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
{:else if tweetEmbed}
	<!-- Twitter/X card built from fxtwitter API -->
	<div class="mt-2">
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			class="flex max-w-lg rounded overflow-hidden border border-discord-divider bg-discord-backgroundSecondary hover:bg-discord-messageHover transition-colors no-underline"
		>
			<!-- Left accent bar -->
			<div class="w-1 flex-shrink-0 bg-discord-accent"></div>

			<div class="flex flex-1 min-w-0 flex-col p-3 gap-2">
				<!-- Author -->
				<div class="flex flex-col min-w-0">
					<p class="text-xs text-discord-textMuted mb-0.5">X / Twitter</p>
					<p class="text-sm font-semibold text-discord-accent leading-snug">{tweetEmbed.authorName} <span class="font-normal text-discord-textMuted">@{tweetEmbed.authorHandle}</span></p>
					{#if tweetEmbed.text}
						<p class="text-xs text-discord-textSecondary mt-1 leading-relaxed line-clamp-4 whitespace-pre-wrap">{tweetEmbed.text}</p>
					{/if}
				</div>

				<!-- Media grid -->
				{#if tweetEmbed.videos.length > 0 || tweetEmbed.photos.length > 0}
					{@const allMedia = [...tweetEmbed.videos.map(v => ({ type: 'video' as const, url: v })), ...tweetEmbed.photos.map(p => ({ type: 'photo' as const, url: p }))]}
					<div
						class="grid gap-1 rounded overflow-hidden"
						style="grid-template-columns: repeat({Math.min(allMedia.length, 2)}, 1fr)"
					>
						{#each allMedia as item, i}
							{#if item.type === 'video'}
								<!-- svelte-ignore a11y_media_has_caption -->
								<video
									src={mediaStore.resolveNoReferrer(item.url) ?? undefined}
									class="w-full max-h-72 object-contain rounded"
									controls
									preload="metadata"
									onclick={(e) => e.preventDefault()}
								></video>
							{:else}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
								<img
									src={item.url}
									alt=""
									class="w-full max-h-72 object-contain rounded cursor-pointer bg-black/10"
									loading="lazy"
									onclick={(e) => { e.preventDefault(); lightboxTweetIndex = i; }}
								/>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		</a>
		{#if lightboxTweetIndex !== null}
			{@const allMedia = [...tweetEmbed.videos.map(v => ({ type: 'video' as const, url: v })), ...tweetEmbed.photos.map(p => ({ type: 'photo' as const, url: p }))]}
			{@const item = allMedia[lightboxTweetIndex]}
			{#if item?.type === 'photo'}
				<Lightbox src={item.url} alt="" onClose={() => (lightboxTweetIndex = null)} />
			{/if}
		{/if}
	</div>
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
		<div class="mt-2">
			<a
				href={preview.canonicalUrl ?? url}
				target="_blank"
				rel="noopener noreferrer"
				class="flex max-w-lg rounded overflow-hidden border border-discord-divider bg-discord-backgroundSecondary hover:bg-discord-messageHover transition-colors no-underline"
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
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					{#if preview.imageUrl && !imageError}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<img
							src={mediaStore.resolve(preview.imageUrl)}
							alt={preview.title ?? ''}
							onerror={() => (imageError = true)}
							class="max-w-full max-h-72 rounded mt-1 object-contain cursor-pointer"
							loading="lazy"
							onclick={(e) => { e.preventDefault(); lightboxOpen = true; }}
						/>
					{/if}
				</div>
			</a>
			{#if lightboxOpen && preview.imageUrl}
				<Lightbox src={mediaStore.resolve(preview.imageUrl) ?? preview.imageUrl} alt="" onClose={() => (lightboxOpen = false)} />
			{/if}
		</div>
	{/if}
{/if}
