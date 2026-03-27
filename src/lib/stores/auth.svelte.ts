const STORAGE_KEY = "matrix_session";

interface StoredSession {
	userId: string;
	accessToken: string;
	deviceId: string;
	homeserverUrl: string;
}

export const auth = $state({
	isAuthenticated: false,
	userId: null as string | null,
	accessToken: null as string | null,
	deviceId: null as string | null,
	homeserverUrl: "",
	syncState: "STOPPED" as string,
	error: null as string | null,
});

export function saveSession(data: StoredSession): void {
	auth.isAuthenticated = true;
	auth.userId = data.userId;
	auth.accessToken = data.accessToken;
	auth.deviceId = data.deviceId;
	auth.homeserverUrl = data.homeserverUrl;
	auth.error = null;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		// ignore storage errors
	}
}

export function loadStoredSession(): StoredSession | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as StoredSession;
	} catch {
		return null;
	}
}

export function clearSession(): void {
	auth.isAuthenticated = false;
	auth.userId = null;
	auth.accessToken = null;
	auth.deviceId = null;
	auth.homeserverUrl = "";
	auth.syncState = "STOPPED";
	auth.error = null;

	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
