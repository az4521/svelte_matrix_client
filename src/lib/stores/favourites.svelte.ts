import {
	loadFavouriteGifs,
	persistFavouriteGifs,
	onAccountData,
	onSyncPrepared,
	type FavouriteGif
} from '$lib/matrix/client';

export type { FavouriteGif };

class FavouritesState {
	gifs = $state<FavouriteGif[]>([]);
}

export const favouritesState = new FavouritesState();

export function isFavouriteGif(url: string): boolean {
	return favouritesState.gifs.some((g) => g.url === url);
}

export async function addFavouriteGif(gif: Omit<FavouriteGif, 'addedAt'>): Promise<void> {
	if (isFavouriteGif(gif.url)) return;
	favouritesState.gifs = [{ ...gif, addedAt: Date.now() }, ...favouritesState.gifs];
	await persistFavouriteGifs(favouritesState.gifs);
}

export async function removeFavouriteGif(url: string): Promise<void> {
	favouritesState.gifs = favouritesState.gifs.filter((g) => g.url !== url);
	await persistFavouriteGifs(favouritesState.gifs);
}

// Call once on app mount. Returns a cleanup function.
export function initFavourites(): () => void {
	// Load immediately in case sync already completed before this was called
	favouritesState.gifs = loadFavouriteGifs();

	// Also reload on sync PREPARED in case we registered before the first sync finished
	const unsubSync = onSyncPrepared(() => {
		favouritesState.gifs = loadFavouriteGifs();
	});
	const unsubAccount = onAccountData((type) => {
		if (type === 'm.favourite_gifs') {
			favouritesState.gifs = loadFavouriteGifs();
		}
	});
	return () => {
		unsubSync();
		unsubAccount();
	};
}
