<script lang="ts">
	import { getUrlPreview, type UrlPreview } from '$lib/matrix/client';
	import Lightbox from '$lib/components/ui/Lightbox.svelte';
	import { favouritesState, isFavouriteGif, addFavouriteGif, removeFavouriteGif } from '$lib/stores/favourites.svelte';

	interface Props {
		url: string;
	}

	let { url }: Props = $props();

	let preview = $state<UrlPreview | null>(null);
	let imageError = $state(false);
	let lightboxOpen = $state(false);

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

	$effect(() => {
		const currentUrl = url;
		preview = null;
		imageError = false;
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

	// Decide layout for card previews: tall image goes on the right, wide image below
	const imageOnRight = $derived.by(() => {
		if (!preview?.imageUrl || !preview.title) return false;
		const w = preview.imageWidth ?? 0;
		const h = preview.imageHeight ?? 0;
		return h > w || (w === 0 && h === 0);
	});
</script>

{#if preview}
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
			<a href={preview.imageUrl} target="_blank" rel="noopener noreferrer" onclick={(e) => { e.preventDefault(); lightboxOpen = true; }}>
				<img
					src={preview.imageUrl}
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
			<Lightbox src={preview.imageUrl} alt="" onClose={() => (lightboxOpen = false)} />
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

			<div class="flex flex-1 min-w-0 {imageOnRight ? 'flex-row' : 'flex-col'} p-3 gap-3">
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
						src={preview.imageUrl}
						alt={preview.title ?? ''}
						onerror={() => (imageError = true)}
						class={imageOnRight
							? 'w-20 h-20 flex-shrink-0 rounded object-cover self-center'
							: 'w-full max-h-52 rounded object-cover mt-1'}
						loading="lazy"
					/>
				{/if}
			</div>
		</a>
	{/if}
{/if}
