// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LevelUpDB } from '#lib/data/db.ts';
import { createDexieStore } from '#lib/data/dexie-store.ts';
import type { Store } from '#lib/data/store.ts';
import type { Progress } from '#lib/domain/types.ts';
import {
	addItems, createList, deleteList, duplicateAsOwn, importFromText, ListError, parseAlternatives,
	removeItem, saveItem, updateListMeta, validateListMeta
} from './lists.ts';

let counter = 0;
let db: LevelUpDB;
let store: Store;

beforeEach(() => {
	db = new LevelUpDB(`level-up-lists-test-${++counter}`);
	store = createDexieStore(db);
});

afterEach(async () => {
	await db.delete();
});

const meta = { title: 'Frans H3', source: 'Nederlands', target: 'Frans' };

const progress = (itemId: string, listId: string): Progress => ({
	itemId, listId, direction: 'forward', box: 2, dueAt: 10, correct: 1, almost: 0, wrong: 0, lastPracticedAt: 5, updatedAt: 5
});

describe('validateListMeta', () => {
	it('eist titel en talen en begrenst de titel', () => {
		expect(validateListMeta({ title: ' ', source: '', target: ' ' })).toEqual({
			title: expect.any(String), source: expect.any(String), target: expect.any(String)
		});
		expect(validateListMeta({ ...meta, title: 'x'.repeat(81) }).title).toMatch(/80/);
		expect(validateListMeta({ ...meta, title: 'x'.repeat(80) })).toEqual({});
	});
});

describe('createList / updateListMeta', () => {
	it('maakt een eigen lijst met uuid en getrimde velden', async () => {
		const list = await createList(store, { title: '  Frans H3 ', source: ' Nederlands', target: 'Frans ' }, 100);
		expect(list).toMatchObject({ title: 'Frans H3', source: 'Nederlands', target: 'Frans', origin: 'own', version: 1, createdAt: 100, updatedAt: 100 });
		expect(list.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(await store.lists.get(list.id)).toEqual(list);
	});

	it('weigert ongeldige invoer met het betreffende veld', async () => {
		await expect(createList(store, { ...meta, title: '' }, 1)).rejects.toMatchObject({ field: 'title' });
		await expect(createList(store, { ...meta, target: ' ' }, 1)).rejects.toMatchObject({ field: 'target' });
		expect(await store.lists.all()).toHaveLength(0);
	});

	it('wijzigt titel en talen en weigert bibliotheeklijsten', async () => {
		const list = await createList(store, meta, 1);
		const updated = await updateListMeta(store, list.id, { title: 'Nieuw', source: 'Engels', target: 'Duits' }, 9);
		expect(updated).toMatchObject({ title: 'Nieuw', source: 'Engels', target: 'Duits', createdAt: 1, updatedAt: 9 });

		await store.lists.put({ ...list, id: 'lib', origin: 'library' });
		await expect(updateListMeta(store, 'lib', meta, 2)).rejects.toBeInstanceOf(ListError);
	});
});

describe('addItems / importFromText', () => {
	it('voegt woorden toe met uuid-id en slaat exacte duplicaten over', async () => {
		const list = await createList(store, meta, 1);
		const first = await addItems(store, list.id, [
			{ term: 'chat', translation: 'kat', alternatives: ['poes'] },
			{ term: 'chat', translation: 'Kat', alternatives: [] },
			{ term: 'chien', translation: 'hond', alternatives: [], example: 'Le chien dort.' }
		], 5);
		expect(first).toEqual({ added: 2, skipped: 1 });
		const second = await addItems(store, list.id, [{ term: 'chien', translation: 'hond', alternatives: [] }], 6);
		expect(second).toEqual({ added: 0, skipped: 1 });

		const items = await store.items.byList(list.id);
		expect(items).toHaveLength(2);
		expect(items.every((i) => /^[0-9a-f-]{36}$/.test(i.id))).toBe(true);
		expect(items.find((i) => i.term === 'chat')?.alternatives).toEqual(['poes']);
		expect(items.find((i) => i.term === 'chien')?.example).toBe('Le chien dort.');
		expect((await store.lists.get(list.id))?.updatedAt).toBe(5);
	});

	it('importeert tekst en meldt aantallen en foutregels', async () => {
		const list = await createList(store, meta, 1);
		const text = 'chat\tkat | poes\nchien\thond\nfout\nchat\tkat\n';
		const result = await importFromText(store, list.id, text, 2);
		expect(result.added).toBe(2);
		expect(result.skipped).toBe(1);
		expect(result.errors).toEqual([{ line: 3, message: expect.any(String) }]);
		const again = await importFromText(store, list.id, 'chien = hond\nmaison = huis', 3);
		expect(again).toMatchObject({ added: 1, skipped: 1, errors: [] });
	});

	it('voegt niets toe aan een bibliotheeklijst of onbekende lijst', async () => {
		await store.lists.put({ id: 'lib', title: 'B', source: 'a', target: 'b', origin: 'library', version: 1, createdAt: 1, updatedAt: 1 });
		await expect(importFromText(store, 'lib', 'a\tb', 1)).rejects.toBeInstanceOf(ListError);
		await expect(importFromText(store, 'nope', 'a\tb', 1)).rejects.toBeInstanceOf(ListError);
	});
});

describe('saveItem / removeItem', () => {
	it('maakt en wijzigt een woord en valideert', async () => {
		const list = await createList(store, meta, 1);
		await expect(saveItem(store, list.id, { term: ' ', translation: 'x', alternatives: [] }, 2)).rejects.toMatchObject({ field: 'term' });
		await expect(saveItem(store, list.id, { term: 'x', translation: '', alternatives: [] }, 2)).rejects.toMatchObject({ field: 'translation' });

		const created = await saveItem(store, list.id, { term: 'chat', translation: 'kat', alternatives: ['poes', 'kat', 'poes'], example: ' ' }, 2);
		expect(created.alternatives).toEqual(['poes']);
		expect(created.example).toBeUndefined();

		const edited = await saveItem(store, list.id, { ...created, translation: 'poes', alternatives: ['kat'], example: 'Le chat.' }, 3);
		expect(edited.id).toBe(created.id);
		expect(await store.items.byList(list.id)).toEqual([edited]);

		await saveItem(store, list.id, { term: 'chien', translation: 'hond', alternatives: [] }, 4);
		await expect(
			saveItem(store, list.id, { term: 'Chien', translation: 'Hond', alternatives: [] }, 5)
		).rejects.toMatchObject({ field: 'translation' });
	});

	it('verwijdert een woord samen met de voortgang', async () => {
		const list = await createList(store, meta, 1);
		const item = await saveItem(store, list.id, { term: 'chat', translation: 'kat', alternatives: [] }, 2);
		await store.progress.put(progress(item.id, list.id));
		await removeItem(store, list.id, item.id, 3);
		expect(await store.items.byList(list.id)).toEqual([]);
		expect(await store.progress.byList(list.id)).toEqual([]);
	});
});

describe('deleteList', () => {
	it('verwijdert lijst, woorden en voortgang', async () => {
		const list = await createList(store, meta, 1);
		const item = await saveItem(store, list.id, { term: 'chat', translation: 'kat', alternatives: [] }, 2);
		await store.progress.put(progress(item.id, list.id));
		await deleteList(store, list.id);
		expect(await store.lists.get(list.id)).toBeUndefined();
		expect(await store.items.byList(list.id)).toEqual([]);
		expect(await store.progress.byList(list.id)).toEqual([]);
	});
});

describe('duplicateAsOwn', () => {
	it('kopieert een bibliotheeklijst naar een eigen lijst zonder voortgang', async () => {
		await store.lists.put({ id: 'lib', title: 'Frans A1', source: 'Nederlands', target: 'Frans', origin: 'library', version: 3, createdAt: 1, updatedAt: 1 });
		await store.items.bulkPut([
			{ id: 'lib/1', listId: 'lib', term: 'chat', translation: 'kat', alternatives: ['poes'], example: 'Le chat.', updatedAt: 1 },
			{ id: 'lib/2', listId: 'lib', term: 'chien', translation: 'hond', alternatives: [], updatedAt: 1 }
		]);
		await store.progress.put(progress('lib/1', 'lib'));

		const copy = await duplicateAsOwn(store, 'lib', 50);
		expect(copy).toMatchObject({ title: 'Frans A1 (kopie)', origin: 'own', version: 1, source: 'Nederlands', target: 'Frans' });
		expect(copy.id).not.toBe('lib');
		const items = await store.items.byList(copy.id);
		expect(items.map((i) => i.term).sort()).toEqual(['chat', 'chien']);
		expect(items.every((i) => i.id !== 'lib/1' && i.id !== 'lib/2')).toBe(true);
		expect(items.find((i) => i.term === 'chat')).toMatchObject({ alternatives: ['poes'], example: 'Le chat.' });
		expect(await store.progress.byList(copy.id)).toEqual([]);
		expect(await store.items.byList('lib')).toHaveLength(2);
	});

	it('houdt de titel binnen de maximale lengte', async () => {
		await store.lists.put({ id: 'x', title: 'y'.repeat(80), source: 'a', target: 'b', origin: 'library', version: 1, createdAt: 1, updatedAt: 1 });
		const copy = await duplicateAsOwn(store, 'x', 1);
		expect(copy.title.length).toBeLessThanOrEqual(80);
		expect(copy.title.endsWith('(kopie)')).toBe(true);
	});
});

describe('parseAlternatives', () => {
	it('splitst op | en ; en laat de hoofdvertaling weg', () => {
		expect(parseAlternatives('poes | kat; poes ;', 'kat')).toEqual(['poes']);
		expect(parseAlternatives('  ')).toEqual([]);
	});
});
