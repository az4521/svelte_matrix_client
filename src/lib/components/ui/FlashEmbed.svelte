<script lang="ts">
	interface Props {
		src: string; // HTTP URL to the SWF
	}

	let { src }: Props = $props();

	let container: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!container) return;
		const currentSrc = src;
		let player: HTMLElement | null = null;

		async function init() {
			// Load Ruffle if not already loaded
			if (!(window as any).RufflePlayer) {
				await new Promise<void>((resolve, reject) => {
					const script = document.createElement('script');
					script.src = '/ruffle/ruffle.js';
					script.onload = () => resolve();
					script.onerror = reject;
					document.head.appendChild(script);
				});
			}

			if (!container) return;
			const ruffle = (window as any).RufflePlayer.newest();
			player = ruffle.createPlayer();
			player.style.width = '100%';
			player.style.height = '100%';
			container.appendChild(player);
			(player as any).load({ url: currentSrc });
		}

		init().catch(console.error);

		return () => {
			player?.remove();
		};
	});
</script>

<div bind:this={container} class="w-full aspect-video max-w-sm rounded-lg overflow-hidden bg-black mt-1"></div>
