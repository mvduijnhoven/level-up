import { createDexieStore } from './dexie-store.ts';
import type { Store } from './store.ts';

let instance: Store | null = null;

/** Lazy singleton: de database wordt pas bij de eerste aanroep gemaakt, zodat importeren veilig is tijdens prerender. */
export function getStore(): Store {
	instance ??= createDexieStore();
	return instance;
}

/** Vervangt (of met `null` herstelt) de store die `getStore()` teruggeeft. Alleen voor tests. */
export function setStoreForTesting(store: Store | null): void {
	instance = store;
}

export type { Store } from './store.ts';
export { createDexieStore } from './dexie-store.ts';
export { LevelUpDB, DB_NAME } from './db.ts';
export { downloadBackup, readBackupFile } from './backup.ts';
export { requestPersistentStorage, estimateStorage } from './storage.ts';
export type { StorageEstimate } from './storage.ts';
export {
	fetchCatalog, fetchLibraryList, installLibraryList, languageName, libraryStatus
} from './library.ts';
export type {
	LibraryCatalog, LibraryEntry, LibraryItem, LibraryListFile, LibraryStatus
} from './library.ts';
