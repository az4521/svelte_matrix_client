const DB_NAME = 'matrix-sw';
const DB_STORE = 'auth';
const APP_ORIGIN = self.location.origin;

function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function dbGet(key) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, 'readonly');
		const req = tx.objectStore(DB_STORE).get(key);
		req.onsuccess = () => resolve(req.result ?? null);
		req.onerror = () => reject(req.error);
	});
}

async function dbSet(key, value) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(DB_STORE, 'readwrite');
		const req = tx.objectStore(DB_STORE).put(value, key);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

function isValidHomeserverUrl(url) {
	try {
		const parsed = new URL(url);
		return parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

let accessToken = null;
let homeserverUrl = null;

const authReady = (async () => {
	const storedToken = await dbGet('accessToken');
	const storedHs = await dbGet('homeserverUrl');
	if (isValidHomeserverUrl(storedHs)) {
		accessToken = storedToken;
		homeserverUrl = storedHs;
	}
})();

self.addEventListener('message', async (event) => {
	// Only accept messages from the app's own origin
	if (event.origin !== APP_ORIGIN) return;
	if (event.data?.type === 'SET_AUTH') {
		const { accessToken: token, homeserverUrl: hs } = event.data;
		if (!isValidHomeserverUrl(hs)) return;
		accessToken = token;
		homeserverUrl = hs;
		await dbSet('accessToken', token);
		await dbSet('homeserverUrl', hs);
	}
});

self.addEventListener('fetch', (event) => {
	const url = event.request.url;

	let parsedUrl;
	try { parsedUrl = new URL(url); } catch { return; }

	// No-referrer proxy for Twitter/twimg video CDN — no fallback to avoid leaking Referer
	if (parsedUrl.hostname === 'video.twimg.com') {
		event.respondWith(
			fetch(new Request(url, {
				method: event.request.method,
				headers: event.request.headers,
				mode: 'cors',
				credentials: 'omit',
				referrerPolicy: 'no-referrer',
			}))
		);
		return;
	}

	// Only inject auth on HTML-element-initiated requests (img, video, audio, etc.)
	// JS fetch calls (destination === '') already include auth headers themselves
	const isElementRequest = event.request.destination !== ''
		&& event.request.destination !== 'document'
		&& event.request.destination !== 'script'
		&& event.request.destination !== 'style';
	const alreadyHasAuth = event.request.headers.has('Authorization');
	if (!parsedUrl.pathname.includes('/_matrix/') || !isElementRequest || alreadyHasAuth) return;

	event.respondWith(
		authReady.then(() => {
			// Check hostname and path prefix so two homeservers on the same domain at different paths can't cross-contaminate
			let hsUrl;
			try { hsUrl = new URL(homeserverUrl); } catch { return fetch(event.request); }
			const hsBase = hsUrl.pathname.endsWith('/') ? hsUrl.pathname : hsUrl.pathname + '/';
			const reqBase = parsedUrl.pathname.endsWith('/') ? parsedUrl.pathname : parsedUrl.pathname + '/';
			if (!accessToken || parsedUrl.hostname !== hsUrl.hostname || !reqBase.startsWith(hsBase)) return fetch(event.request);

			const headers = new Headers(event.request.headers);
			headers.set('Authorization', `Bearer ${accessToken}`);
			return fetch(url, {
				method: event.request.method,
				headers,
				cache: 'default',
			});
		}).catch(() => fetch(event.request))
	);
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
