<script lang="ts">
	import { mediaStore } from '$lib/stores/media.svelte';

	interface Props {
		src?: string | null;
		name?: string;
		size?: number;
		rounded?: 'full' | 'lg' | 'md';
	}

	let { src = null, name = '?', size = 40, rounded = 'full' }: Props = $props();

	const resolvedSrc = $derived(mediaStore.resolve(src));

	const initials = $derived(() => {
		if (!name) return '?';
		const words = name.trim().split(/\s+/);
		if (words.length === 1) return words[0][0]?.toUpperCase() ?? '?';
		return (words[0][0] + words[words.length - 1][0]).toUpperCase();
	});

	// Deterministic color from name
	const bgColor = $derived(() => {
		const colors = [
			'#5865F2',
			'#3BA55C',
			'#ED4245',
			'#FAA61A',
			'#EB459E',
			'#00B0F0',
			'#9475F5',
			'#23A559'
		];
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	});

	const roundedClass = $derived(() => {
		if (rounded === 'full') return 'rounded-full';
		if (rounded === 'lg') return 'rounded-lg';
		return 'rounded-md';
	});
</script>

<div
	class="flex-shrink-0 flex items-center justify-center overflow-hidden {roundedClass()}"
	style="width: {size}px; height: {size}px; background-color: {resolvedSrc ? 'transparent' : bgColor()};"
>
	{#if resolvedSrc}
		<img src={resolvedSrc} alt={name} class="w-full h-full object-cover {roundedClass()}" />
	{:else}
		<span class="text-white font-semibold select-none" style="font-size: {size * 0.4}px;">
			{initials()}
		</span>
	{/if}
</div>
