import type { WordList } from '#lib/domain/types.ts';
import {
	fetchCatalog, fetchLibraryList, installLibraryList, libraryStatus,
	type LibraryEntry, type LibraryStatus
} from '#lib/data/library.ts';
import type { Store } from '#lib/data/store.ts';

export interface LibraryViewItem {
	entry: LibraryEntry;
	installed?: WordList;
	status: LibraryStatus;
}

export interface InstallOutcome {
	kind: 'added' | 'updated';
	listId: string;
	/** Aantal woorden in de lijst na het installeren. */
	wordCount: number;
	added: number;
	updated: number;
	removed: number;
}

/** Combineert de catalogus met de lokaal opgeslagen lijsten. */
export function combineLibrary(entries: LibraryEntry[], lists: WordList[]): LibraryViewItem[] {
	const byId = new Map(lists.map((list) => [list.id, list]));
	return entries.map((entry) => {
		const installed = byId.get(entry.id);
		return { entry, installed, status: libraryStatus(entry, installed) };
	});
}

export async function loadLibrary(store: Store, fetchFn: typeof fetch, baseUrl: string): Promise<LibraryViewItem[]> {
	const [entries, lists] = await Promise.all([fetchCatalog(fetchFn, baseUrl), store.lists.all()]);
	return combineLibrary(entries, lists);
}

/** Lokaal toegevoegde bibliotheeklijsten; blijven bruikbaar als de catalogus niet geladen kan worden. */
export async function loadInstalledLibraryLists(store: Store): Promise<WordList[]> {
	const lists = await store.lists.all();
	return lists.filter((list) => list.origin === 'library').sort((a, b) => a.title.localeCompare(b.title, 'nl'));
}

/** Haalt het lijstbestand op en voegt de lijst toe of werkt hem bij; voortgang blijft behouden. */
export async function installFromLibrary(
	store: Store,
	fetchFn: typeof fetch,
	baseUrl: string,
	item: LibraryViewItem,
	now: number
): Promise<InstallOutcome> {
	const file = await fetchLibraryList(fetchFn, baseUrl, item.entry.file);
	const result = await installLibraryList(store, file, now);
	return {
		kind: item.installed ? 'updated' : 'added',
		listId: file.id,
		wordCount: file.items.length,
		...result
	};
}

export function wordsLabel(count: number): string {
	return count === 1 ? '1 woord' : `${count} woorden`;
}

export function describeInstall(title: string, outcome: InstallOutcome): string {
	if (outcome.kind === 'added') return `${title} toegevoegd (${wordsLabel(outcome.wordCount)})`;
	const changes: string[] = [];
	if (outcome.added > 0) changes.push(`${outcome.added} nieuw`);
	if (outcome.updated > 0) changes.push(`${outcome.updated} aangepast`);
	if (outcome.removed > 0) changes.push(`${outcome.removed} verwijderd`);
	const summary = changes.length > 0 ? changes.join(', ') : 'geen wijzigingen in de woorden';
	return `${title} bijgewerkt: ${summary}. Je voortgang blijft behouden.`;
}
