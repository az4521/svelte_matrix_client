<script lang="ts">
	import Lightbox from "$lib/components/ui/Lightbox.svelte";

	interface Props {
		url: string;
	}

	let { url }: Props = $props();

	type Mode = "img" | "video" | "none";
	let mode = $state<Mode>("img");
	let lightboxOpen = $state(false);
</script>

{#if mode === "img"}
	<!-- svelte-ignore a11y_missing_attribute -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<img
		src={url}
		onerror={() => (mode = "video")}
		class="max-w-sm max-h-72 rounded-lg object-contain mt-1 cursor-pointer"
		loading="lazy"
		onclick={() => (lightboxOpen = true)}
	/>
	{#if lightboxOpen}
		<Lightbox src={url} onClose={() => (lightboxOpen = false)} />
	{/if}
{:else if mode === "video"}
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		src={url}
		onerror={() => (mode = "none")}
		controls
		class="max-w-sm max-h-72 rounded-lg mt-1"
		preload="metadata"
	></video>
{/if}
