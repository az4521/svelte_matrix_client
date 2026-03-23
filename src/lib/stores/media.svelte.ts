import { fetchMediaWithAuth } from '$lib/matrix/client';

class MediaStore {
	private cache = $state<Record<string, string>>({});
	private fetching = new Set<string>();

	/**
	 * Returns a blob URL for the given src, fetching it with the Matrix auth
	 * header if it is a homeserver media URL.  Non-matrix URLs pass through
	 * unchanged.  Returns null (and kicks off a fetch) the first time a
	 * matrix URL is seen — reactive callers will re-run once the blob is ready.
	 */
	resolve(url: string | null | undefined): string | null {
		if (!url) return null;
		// Non-matrix URLs (e.g. Tenor, external og:image) pass through as-is
		if (!url.includes('/_matrix/')) return url;

		const cached = this.cache[url];
		if (cached) return cached;

		if (!this.fetching.has(url)) {
			this.fetching.add(url);
			fetchMediaWithAuth(url).then((blobUrl) => {
				this.fetching.delete(url);
				if (blobUrl) this.cache[url] = blobUrl;
			});
		}
		return null;
	}
}

export const mediaStore = new MediaStore();
