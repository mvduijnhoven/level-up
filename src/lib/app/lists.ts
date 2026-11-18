import { parseWordList, type ParsedItem, type ParseError } from '#lib/domain/parse.ts';
import type { Item, WordList } from '#lib/domain/types.ts';
import type { Store } from '#lib/data/store.ts';

export const MAX_TITLE_LENGTH = 80;

export type ListField = 'title' | 'source' | 'target' | 'term' | 'translation';

/** Fout met een leesbare Nederlandse tekst; `field` wijst het invoerveld aan waar de melding bij hoort. */
export class ListError extends Error {
	readonly field?: ListField;

	constructor(message: string, field?: ListField) {
		super(message);
		this.name = 'ListError';
		this.field = field;
	}
}

export interface ListMeta {
	title: string;
	source: string;
	target: string;
}

export type ListMetaErrors = Partial<Record<'title' | 'source' | 'target', string>>;

export interface ItemDraft {
	/** Leeg voor een nieuw woord. */
	id?: string;
	term: string;
	translation: string;
	alternatives: string[];
	example?: string;
}

export interface ImportSummary {
	added: number;
	skipped: number;
	errors: ParseError[];
}

/** Geeft per ongeldig veld een melding terug; een leeg object betekent dat alles klopt. */
export function validateListMeta(meta: ListMeta): ListMetaErrors {
	const errors: ListMetaErrors = {};
	const title = meta.title.trim();
	if (title === '') errors.title = 'Geef je lijst een titel.';
	else if (title.length > MAX_TITLE_LENGTH) {
		errors.title = `De titel mag maximaal ${MAX_TITLE_LENGTH} tekens zijn.`;
	}
	if (meta.source.trim() === '') errors.source = 'Kies of typ de taal van de woorden die je ziet.';
	if (meta.target.trim() === '') errors.target = 'Kies of typ de taal van de vertalingen.';
	return errors;
}

function assertValidMeta(meta: ListMeta): void {
	const errors = validateListMeta(meta);
	for (const field of ['title', 'source', 'target'] as const) {
		const message = errors[field];
		if (message) throw new ListError(message, field);
	}
}

/** Splitst een tekst met extra goede vertalingen op | of ; en laat dubbele en lege delen weg. */
export function parseAlternatives(text: string, translation = ''): string[] {
	const main = translation.trim();
	const parts = text
		.split(/[|;]/)
		.map((part) => part.trim())
		.filter((part) => part !== '' && part !== main);
	return [...new Set(parts)];
}

function pairKey(term: string, translation: string): string {
	return `${term.trim().normalize('NFC').toLowerCase()}\u0000${translation.trim().normalize('NFC').toLowerCase()}`;
}

async function getOwnList(store: Store, listId: string): Promise<WordList> {
	const list = await store.lists.get(listId);
	if (!list) throw new ListError('Deze lijst bestaat niet (meer).');
	if (list.origin !== 'own') {
		throw new ListError('Een lijst uit de bibliotheek kun je niet wijzigen. Maak er eerst een eigen kopie van.');
	}
	return list;
}

async function touch(store: Store, list: WordList, now: number): Promise<void> {
	await store.lists.put({ ...list, updatedAt: now });
}

export async function createList(store: Store, meta: ListMeta, now: number): Promise<WordList> {
	assertValidMeta(meta);
	const list: WordList = {
		id: crypto.randomUUID(),
		title: meta.title.trim(),
		source: meta.source.trim(),
		target: meta.target.trim(),
		origin: 'own',
		version: 1,
		createdAt: now,
		updatedAt: now
	};
	await store.lists.put(list);
	return list;
}

export async function updateListMeta(
	store: Store,
	listId: string,
	meta: ListMeta,
	now: number
): Promise<WordList> {
	const list = await getOwnList(store, listId);
	assertValidMeta(meta);
	const updated: WordList = {
		...list,
		title: meta.title.trim(),
		source: meta.source.trim(),
		target: meta.target.trim(),
		updatedAt: now
	};
	await store.lists.put(updated);
	return updated;
}

/** Voegt woorden toe en slaat woorden over die (term + vertaling) al in de lijst staan of dubbel in de invoer zitten. */
export async function addItems(
	store: Store,
	listId: string,
	parsedItems: ParsedItem[],
	now: number
): Promise<{ added: number; skipped: number }> {
	const list = await getOwnList(store, listId);
	const seen = new Set((await store.items.byList(listId)).map((i) => pairKey(i.term, i.translation)));
	const fresh: Item[] = [];
	let skipped = 0;
	for (const parsed of parsedItems) {
		const term = parsed.term.trim();
		const translation = parsed.translation.trim();
		if (term === '' || translation === '') {
			skipped++;
			continue;
		}
		const key = pairKey(term, translation);
		if (seen.has(key)) {
			skipped++;
			continue;
		}
		seen.add(key);
		const item: Item = {
			id: crypto.randomUUID(),
			listId,
			term,
			translation,
			alternatives: parseAlternatives(parsed.alternatives.join('|'), translation),
			updatedAt: now
		};
		const example = parsed.example?.trim();
		if (example) item.example = example;
		fresh.push(item);
	}
	if (fresh.length > 0) {
		await store.items.bulkPut(fresh);
		await touch(store, list, now);
	}
	return { added: fresh.length, skipped };
}

/** Maakt of wijzigt één woord. Gooit een ListError als er iets ontbreekt of het woord al bestaat. */
export async function saveItem(store: Store, listId: string, draft: ItemDraft, now: number): Promise<Item> {
	const list = await getOwnList(store, listId);
	const term = draft.term.trim();
	const translation = draft.translation.trim();
	if (term === '') throw new ListError('Vul het woord in.', 'term');
	if (translation === '') throw new ListError('Vul de vertaling in.', 'translation');

	const existing = await store.items.byList(listId);
	const key = pairKey(term, translation);
	if (existing.some((i) => i.id !== draft.id && pairKey(i.term, i.translation) === key)) {
		throw new ListError('Dit woord met deze vertaling staat al in de lijst.', 'translation');
	}
	if (draft.id && !existing.some((i) => i.id === draft.id)) {
		throw new ListError('Dit woord bestaat niet (meer).');
	}

	const item: Item = {
		id: draft.id ?? crypto.randomUUID(),
		listId,
		term,
		translation,
		alternatives: parseAlternatives(draft.alternatives.join('|'), translation),
		updatedAt: now
	};
	const example = draft.example?.trim();
	if (example) item.example = example;
	await store.items.put(item);
	await touch(store, list, now);
	return item;
}

/** Verwijdert het woord en de voortgang ervan. */
export async function removeItem(store: Store, listId: string, itemId: string, now: number): Promise<void> {
	const list = await getOwnList(store, listId);
	await store.items.delete(itemId);
	await touch(store, list, now);
}

export async function importFromText(
	store: Store,
	listId: string,
	text: string,
	now: number
): Promise<ImportSummary> {
	const parsed = parseWordList(text);
	const { added, skipped } = await addItems(store, listId, parsed.items, now);
	return { added, skipped: skipped + parsed.duplicates, errors: parsed.errors };
}

/** Verwijdert de lijst met alle woorden en voortgang. */
export async function deleteList(store: Store, listId: string): Promise<void> {
	await store.lists.delete(listId);
}

/** Maakt een eigen kopie van een lijst (bijvoorbeeld uit de bibliotheek); voortgang wordt niet meegekopieerd. */
export async function duplicateAsOwn(store: Store, listId: string, now: number): Promise<WordList> {
	const source = await store.lists.get(listId);
	if (!source) throw new ListError('Deze lijst bestaat niet (meer).');
	const suffix = ' (kopie)';
	const copy = await createList(
		store,
		{
			title: source.title.slice(0, MAX_TITLE_LENGTH - suffix.length).trimEnd() + suffix,
			source: source.source,
			target: source.target
		},
		now
	);
	const items = (await store.items.byList(listId)).map(
		(item): Item => ({ ...item, id: crypto.randomUUID(), listId: copy.id, updatedAt: now })
	);
	if (items.length > 0) await store.items.bulkPut(items);
	return copy;
}
