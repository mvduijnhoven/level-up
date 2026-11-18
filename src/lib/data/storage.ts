export interface StorageEstimate {
	/** Gebruikte bytes. */
	usage: number;
	/** Beschikbare bytes volgens de browser. */
	quota: number;
}

/** Vraagt blijvende opslag aan; geeft true als de browser die toekent. */
export async function requestPersistentStorage(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !navigator.storage) return false;
	try {
		if (typeof navigator.storage.persisted === 'function' && (await navigator.storage.persisted())) return true;
		if (typeof navigator.storage.persist !== 'function') return false;
		return await navigator.storage.persist();
	} catch {
		return false;
	}
}

/** Schatting van het opslaggebruik, of null als de browser dat niet ondersteunt. */
export async function estimateStorage(): Promise<StorageEstimate | null> {
	if (typeof navigator === 'undefined' || typeof navigator.storage?.estimate !== 'function') return null;
	try {
		const { usage, quota } = await navigator.storage.estimate();
		return { usage: usage ?? 0, quota: quota ?? 0 };
	} catch {
		return null;
	}
}
