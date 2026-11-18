// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Progress, WordList } from '#lib/domain/types.ts';
import { LevelUpDB } from './db.ts';
import { createDexieStore } from './dexie-store.ts';
import {
	fetchCatalog, fetchLibraryList, installLibraryList, languageName, libraryStatus,
	type LibraryEntry, type LibraryListFile
} from './library.ts';
import type { Store } from './store.ts';

let counter = 0;
let db: LevelUpDB;
let store: Store;

beforeEach(() => {
	db = new LevelUpDB(`level-up-lib-test-${++counter}`);
	store = createDexieStore(db);
});
afterEach(async () => {
	await db.delete();
});

const fileV1: LibraryListFile = {
	id: 'fr-nl-basis-1',
	version: 1,
	title: 'Frans basiswoorden 1',
	source: 'nl',
	target: 'fr',
	items: [
		{ id: 'huis', term: 'het huis', translation: 'la maison' },
		{ id: 'fiets', term: 'de fiets', translation: 'le vélo', alternatives: ['la bicyclette'], example: 'Je fais du vélo.' },
		{ id: 'boek', term: 'het boek', translation: 'le livre' }
	]
};

const prog = (itemId: string): Progress => ({
	itemId, listId: 'fr-nl-basis-1', direction: 'forward', box: 2, dueAt: 5, correct: 3, almost: 0, wrong: 1,
	lastPracticedAt: 4, updatedAt: 4
});

describe('languageName', () => {
	it('vertaalt bekende codes en kapitaliseert onbekende', () => {
		expect(languageName('nl')).toBe('Nederlands');
		expect(languageName('fr')).toBe('Frans');
		expect(languageName('en')).toBe('Engels');
		expect(languageName('de')).toBe('Duits');
		expect(languageName('es')).toBe('Spaans');
		expect(languageName('it')).toBe('Italiaans');
		expect(languageName('la')).toBe('Latijn');
		expect(languageName('el')).toBe('Grieks');
		expect(languageName('pt')).toBe('Pt');
	});
});

describe('fetch', () => {
	const respond = (body: unknown, ok = true) =>
		vi.fn(async () => ({ ok, json: async () => body }) as Response) as unknown as typeof fetch;

	it('haalt de catalogus op met het basispad', async () => {
		const entry: LibraryEntry = {
			id: 'a', version: 1, title: 'A', source: 'nl', target: 'fr', itemCount: 2, file: 'a.json'
		};
		const f = respond({ lists: [entry] });
		expect(await fetchCatalog(f, '/level-up/')).toEqual([entry]);
		expect(f).toHaveBeenCalledWith('/level-up/lists/index.json');
	});

	it('haalt een lijstbestand op en valideert het', async () => {
		const f = respond(fileV1);
		const result = await fetchLibraryList(f, '', 'fr-nl-basis-1.json');
		expect(result.items[0].alternatives).toEqual([]);
		expect(f).toHaveBeenCalledWith('/lists/fr-nl-basis-1.json');
	});

	it('geeft Nederlandse fouten bij netwerkproblemen en ongeldige data', async () => {
		await expect(fetchCatalog(respond({}, false), '')).rejects.toThrow(/bibliotheek/);
		const failing = vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
		await expect(fetchCatalog(failing, '')).rejects.toThrow(/internetverbinding/);
		await expect(fetchCatalog(respond({ nope: 1 }), '')).rejects.toThrow(/ongeldig/);
		await expect(fetchLibraryList(respond({ id: 'x' }), '', 'x.json')).rejects.toThrow(/ongeldig/);
		await expect(fetchLibraryList(respond(fileV1), '', '../x.json')).rejects.toThrow(/ongeldig/);
	});
});

describe('installLibraryList', () => {
	it('installeert een nieuwe lijst', async () => {
		const result = await installLibraryList(store, fileV1, 1000);
		expect(result).toEqual({ added: 3, updated: 0, removed: 0 });
		const list = await store.lists.get('fr-nl-basis-1');
		expect(list).toMatchObject({
			origin: 'library', version: 1, source: 'Nederlands', target: 'Frans', createdAt: 1000, updatedAt: 1000
		});
		const items = await store.items.byList('fr-nl-basis-1');
		expect(items).toHaveLength(3);
		const huis = items.find((i) => i.id === 'fr-nl-basis-1/huis');
		expect(huis).toMatchObject({ listId: 'fr-nl-basis-1', term: 'het huis', alternatives: [] });
		expect(items.find((i) => i.id === 'fr-nl-basis-1/fiets')).toMatchObject({
			alternatives: ['la bicyclette'], example: 'Je fais du vélo.'
		});
	});

	it('werkt bij met behoud van voortgang en verwijdert verdwenen items', async () => {
		await installLibraryList(store, fileV1, 1000);
		await store.progress.bulkPut([prog('fr-nl-basis-1/huis'), prog('fr-nl-basis-1/fiets'), prog('fr-nl-basis-1/boek')]);

		const v2: LibraryListFile = {
			...fileV1,
			version: 2,
			title: 'Frans basiswoorden 1 (nieuw)',
			items: [
				{ id: 'huis', term: 'het huis', translation: 'la maison' },
				{ id: 'fiets', term: 'de fiets', translation: 'le vélo', alternatives: ['la bicyclette', 'le cycle'] },
				{ id: 'kat', term: 'de kat', translation: 'le chat' }
			]
		};
		const result = await installLibraryList(store, v2, 2000);
		expect(result).toEqual({ added: 1, updated: 1, removed: 1 });
		expect(await store.lists.get('fr-nl-basis-1')).toMatchObject({
			version: 2, title: 'Frans basiswoorden 1 (nieuw)', createdAt: 1000, updatedAt: 2000
		});
		const items = await store.items.byList('fr-nl-basis-1');
		expect(items.map((i) => i.id).sort()).toEqual(['fr-nl-basis-1/fiets', 'fr-nl-basis-1/huis', 'fr-nl-basis-1/kat']);
		expect(items.find((i) => i.id.endsWith('/huis'))?.updatedAt).toBe(1000);
		expect(items.find((i) => i.id.endsWith('/fiets'))?.alternatives).toEqual(['la bicyclette', 'le cycle']);
		expect(await store.progress.get('fr-nl-basis-1/huis', 'forward')).toBeDefined();
		expect(await store.progress.get('fr-nl-basis-1/fiets', 'forward')).toBeDefined();
		expect(await store.progress.get('fr-nl-basis-1/boek', 'forward')).toBeUndefined();
	});

	it('weigert ongeldige bestanden zonder iets te schrijven', async () => {
		const dup = { ...fileV1, items: [fileV1.items[0], { ...fileV1.items[1], id: 'huis' }] };
		const empty = { ...fileV1, items: [{ id: 'x', term: ' ', translation: 'y' }] };
		const noId = { ...fileV1, items: [{ id: '', term: 'a', translation: 'b' }] };
		for (const bad of [dup, empty, noId, { ...fileV1, id: '' }, { ...fileV1, version: 0 }, null]) {
			await expect(installLibraryList(store, bad as LibraryListFile, 1)).rejects.toThrow(/ongeldig|leeg|dubbel/);
		}
		expect(await store.lists.all()).toEqual([]);
	});

	it('overschrijft geen eigen lijst met hetzelfde id', async () => {
		const own: WordList = {
			id: 'fr-nl-basis-1', title: 'Mijn lijst', source: 'x', target: 'y', origin: 'own', version: 1, createdAt: 1, updatedAt: 1
		};
		await store.lists.put(own);
		await expect(installLibraryList(store, fileV1, 1)).rejects.toThrow(/eigen woordenlijst/);
		expect(await store.lists.get(own.id)).toEqual(own);
	});
});

describe('libraryStatus', () => {
	const entry: LibraryEntry = {
		id: 'a', version: 2, title: 'A', source: 'nl', target: 'fr', itemCount: 1, file: 'a.json'
	};
	const installed = (version: number, origin: 'own' | 'library' = 'library'): WordList => ({
		id: 'a', title: 'A', source: 'Nederlands', target: 'Frans', origin, version, createdAt: 1, updatedAt: 1
	});

	it('bepaalt de status', () => {
		expect(libraryStatus(entry)).toBe('not-installed');
		expect(libraryStatus(entry, installed(1))).toBe('update-available');
		expect(libraryStatus(entry, installed(2))).toBe('installed');
		expect(libraryStatus(entry, installed(3))).toBe('installed');
		expect(libraryStatus(entry, installed(1, 'own'))).toBe('not-installed');
	});
});
