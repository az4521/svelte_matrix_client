<script lang="ts">
    interface Props {
        src: string;
        alt?: string;
        onClose: () => void;
    }

    import { mobileState } from "$lib/stores/mobile.svelte";
    import { onMount } from "svelte";

    let { src, alt = "", onClose }: Props = $props();

    onMount(() => {
        mobileState.lightboxOpen = true;
        return () => {
            mobileState.lightboxOpen = false;
        };
    });

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") onClose();
    }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80"
    onclick={(e) => {
        e.stopPropagation();
        onClose();
    }}
>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <img
        {src}
        {alt}
        onclick={(e) => e.stopPropagation()}
        style="max-width: calc(100dvw - {mobileState.isMobile
            ? '6em'
            : '2em'}); max-height: calc(100dvh - {mobileState.isMobile
            ? '6em'
            : '2em'}); object-fit: contain; border-radius: 0.5em;"
    />
</div>
