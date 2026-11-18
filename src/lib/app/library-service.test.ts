// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LevelUpDB } from '#lib/data/db.ts';
import { createDexieStore } from '#lib/data/dexie-store.ts';
import type { Store } from '#lib/data/store.ts';
import {
	combineLibrary, describeInstall, installFromLibrary, loadInstalledLibraryLists, loadLibrary
} from './library-service.ts';

let counter = 0;
let db: LevelUpDB;
let store: Store;

beforeEach(() => {
	db = new LevelUpDB(`level-up-libsvc-test-${++counter}`);
	store = createDexieStore(db);
});
afterEach(async () => {
	await db.delete();
});

const catalog = (version = 1) => ({
	lists: [
		{ id: 'fr-1', version, title: 'Frans 1', source: 'nl', target: 'fr', itemCount: 2, file: 'fr-1.json' }
	]
});

const listFile = (version = 1, extra = false) => ({
	id: 'fr-1',
	version,
	title: 'Frans 1',
	source: 'nl',
	target: 'fr',
	items: [
		{ id: 'huis', term: 'het huis', translation: 'la maison' },
		{ id: 'boek', term: 'het boek', translation: extra ? 'le bouquin' : 'le livre' },
		...(extra ? [{ id: 'pen', term: 'de pen', translation: 'le stylo' }] : [])
	]
});

function stubFetch(routes: Record<string, unknown>): typeof fetch {
	return vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		const key = Object.keys(routes).find((k) => url.endsWith(k));
		if (!key) return new Response('', { status: 404 });
		return new Response(JSON.stringify(routes[key]), { status: 200 });
	}) as unknown as typeof fetch;
}

describe('library-service', () => {
	it('toont een lijst als niet geïnstalleerd en na installeren als toegevoegd', async () => {
		const fetchFn = stubFetch({ '/lists/index.json': catalog(), '/lists/fr-1.json': listFile() });
		const before = await loadLibrary(store, fetchFn, '/app');
		expect(before[0].status).toBe('not-installed');

		const outcome = await installFromLibrary(store, fetchFn, '/app', before[0], 1000);
		expect(outcome).toMatchObject({ kind: 'added', wordCount: 2, added: 2 });
		expect(describeInstall('Frans 1', outcome)).toBe('Frans 1 toegevoegd (2 woorden)');

		const after = await loadLibrary(store, fetchFn, '/app');
		expect(after[0].status).toBe('installed');
		expect(after[0].installed?.id).toBe('fr-1');
	});

	it('werkt bij en behoudt voortgang van ongewijzigde woorden', async () => {
		const first = stubFetch({ '/lists/index.json': catalog(), '/lists/fr-1.json': listFile() });
		const [item] = await loadLibrary(store, first, '');
		await installFromLibrary(store, first, '', item, 1000);
		await store.progress.put({
			itemId: 'fr-1/huis', listId: 'fr-1', direction: 'forward', box: 3, dueAt: 5, correct: 2, almost: 0,
			wrong: 0, lastPracticedAt: 4, updatedAt: 4
		});

		const second = stubFetch({ '/lists/index.json': catalog(2), '/lists/fr-1.json': listFile(2, true) });
		const [updatable] = await loadLibrary(store, second, '');
		expect(updatable.status).toBe('update-available');
		const outcome = await installFromLibrary(store, second, '', updatable, 2000);
		expect(outcome).toMatchObject({ kind: 'updated', added: 1, updated: 1, removed: 0 });
		expect(describeInstall('Frans 1', outcome)).toBe(
			'Frans 1 bijgewerkt: 1 nieuw, 1 aangepast. Je voortgang blijft behouden.'
		);
		expect((await store.progress.get('fr-1/huis', 'forward'))?.box).toBe(3);
	});

	it('gooit een leesbare fout als de catalogus niet geladen kan worden', async () => {
		const failing = vi.fn(async () => {
			throw new TypeError('offline');
		}) as unknown as typeof fetch;
		await expect(loadLibrary(store, failing, '')).rejects.toThrow(/internetverbinding/);
	});

	it('geeft al toegevoegde bibliotheeklijsten terug zonder netwerk', async () => {
		const fetchFn = stubFetch({ '/lists/index.json': catalog(), '/lists/fr-1.json': listFile() });
		const [item] = await loadLibrary(store, fetchFn, '');
		await installFromLibrary(store, fetchFn, '', item, 1000);
		await store.lists.put({
			id: 'own', title: 'Eigen', source: 'Nederlands', target: 'Frans', origin: 'own', version: 1,
			createdAt: 1, updatedAt: 1
		});
		const lists = await loadInstalledLibraryLists(store);
		expect(lists.map((l) => l.id)).toEqual(['fr-1']);
	});

	it('combineLibrary gebruikt lege lijst zonder installaties', () => {
		expect(combineLibrary([], [])).toEqual([]);
	});

	it('beschrijft een update zonder wijzigingen', () => {
		expect(
			describeInstall('X', { kind: 'updated', listId: 'x', wordCount: 3, added: 0, updated: 0, removed: 0 })
		).toBe('X bijgewerkt: geen wijzigingen in de woorden. Je voortgang blijft behouden.');
	});
});
