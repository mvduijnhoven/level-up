import type { Item, WordList } from '#lib/domain/types.ts';
import type { Store } from './store.ts';

export interface LibraryEntry {
	id: string;
	version: number;
	title: string;
	/** Taalcode van de brontaal, bijvoorbeeld "nl". */
	source: string;
	/** Taalcode van de doeltaal, bijvoorbeeld "fr". */
	target: string;
	itemCount: number;
	/** Bestandsnaam van het lijstbestand in `lists/`. */
	file: string;
}

export interface LibraryCatalog {
	lists: LibraryEntry[];
}

export interface LibraryItem {
	id: string;
	term: string;
	translation: string;
	alternatives?: string[];
	example?: string;
}

export interface LibraryListFile {
	id: string;
	version: number;
	title: string;
	source: string;
	target: string;
	items: LibraryItem[];
}

export type LibraryStatus = 'not-installed' | 'installed' | 'update-available';

const LANGUAGES: Record<string, string> = {
	nl: 'Nederlands',
	fr: 'Frans',
	en: 'Engels',
	de: 'Duits',
	es: 'Spaans',
	it: 'Italiaans',
	la: 'Latijn',
	el: 'Grieks'
};

export function languageName(code: string): string {
	const known = LANGUAGES[code.trim().toLowerCase()];
	if (known) return known;
	return code.charAt(0).toUpperCase() + code.slice(1);
}

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(r: Rec, key: string, where: string): string {
	const v = r[key];
	if (typeof v !== 'string' || v.trim() === '') {
		throw new Error(`${where}: het veld "${key}" ontbreekt of is leeg.`);
	}
	return v;
}

function version(r: Rec, where: string): number {
	const v = r.version;
	if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
		throw new Error(`${where}: de versie moet een positief geheel getal zijn.`);
	}
	return v;
}

function parseEntry(value: unknown, index: number): LibraryEntry {
	const where = `Bibliotheekitem ${index + 1}`;
	if (!isRecord(value)) throw new Error(`${where} is ongeldig.`);
	const file = text(value, 'file', where);
	if (/[\\/]/.test(file) || file.startsWith('.')) throw new Error(`${where}: de bestandsnaam is ongeldig.`);
	const itemCount = value.itemCount;
	if (typeof itemCount !== 'number' || !Number.isInteger(itemCount) || itemCount < 0) {
		throw new Error(`${where}: het aantal woorden is ongeldig.`);
	}
	return {
		id: text(value, 'id', where),
		version: version(value, where),
		title: text(value, 'title', where),
		source: text(value, 'source', where),
		target: text(value, 'target', where),
		itemCount,
		file
	};
}

/** Controleert een lijstbestand uit de bibliotheek en geeft een genormaliseerd exemplaar terug. */
export function parseLibraryList(data: unknown): LibraryListFile {
	if (!isRecord(data)) throw new Error('Deze woordenlijst is ongeldig: het bestand heeft de verkeerde opbouw.');
	const where = 'Deze woordenlijst is ongeldig';
	const id = text(data, 'id', where);
	if (id.includes('/')) throw new Error(`${where}: het id mag geen "/" bevatten.`);
	if (!Array.isArray(data.items)) throw new Error(`${where}: de lijst met woorden ontbreekt.`);
	const seen = new Set<string>();
	const items = data.items.map((raw: unknown, i: number): LibraryItem => {
		const w = `${where} (woord ${i + 1})`;
		if (!isRecord(raw)) throw new Error(`${w}: het woord is ongeldig.`);
		const itemId = text(raw, 'id', w);
		if (seen.has(itemId)) throw new Error(`${w}: het id "${itemId}" komt dubbel voor.`);
		seen.add(itemId);
		const alternatives = raw.alternatives ?? [];
		if (!Array.isArray(alternatives) || !alternatives.every((a) => typeof a === 'string')) {
			throw new Error(`${w}: de alternatieve antwoorden zijn ongeldig.`);
		}
		if (raw.example !== undefined && typeof raw.example !== 'string') {
			throw new Error(`${w}: de voorbeeldzin is ongeldig.`);
		}
		const item: LibraryItem = {
			id: itemId,
			term: text(raw, 'term', w),
			translation: text(raw, 'translation', w),
			alternatives: [...alternatives]
		};
		if (typeof raw.example === 'string' && raw.example !== '') item.example = raw.example;
		return item;
	});
	return {
		id,
		version: version(data, where),
		title: text(data, 'title', where),
		source: text(data, 'source', where),
		target: text(data, 'target', where),
		items
	};
}

function trimSlash(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

async function fetchJson(fetchFn: typeof fetch, url: string): Promise<unknown> {
	let response: Response;
	try {
		response = await fetchFn(url);
	} catch {
		throw new Error('De bibliotheek kon niet worden geladen. Controleer je internetverbinding en probeer het opnieuw.');
	}
	if (!response.ok) {
		throw new Error('De bibliotheek kon niet worden geladen. Probeer het later opnieuw.');
	}
	try {
		return await response.json();
	} catch {
		throw new Error('De bibliotheek bevat een bestand dat niet gelezen kan worden.');
	}
}

/** `baseUrl` is het basispad van de app (bijvoorbeeld `base` uit `$app/paths`); de bestanden staan in `<baseUrl>/lists/`. */
export async function fetchCatalog(fetchFn: typeof fetch, baseUrl: string): Promise<LibraryEntry[]> {
	const data = await fetchJson(fetchFn, `${trimSlash(baseUrl)}/lists/index.json`);
	if (!isRecord(data) || !Array.isArray(data.lists)) {
		throw new Error('De catalogus van de bibliotheek is ongeldig.');
	}
	return data.lists.map(parseEntry);
}

export async function fetchLibraryList(
	fetchFn: typeof fetch,
	baseUrl: string,
	file: string
): Promise<LibraryListFile> {
	if (/[\\/]/.test(file) || file.startsWith('.')) throw new Error('De bestandsnaam van de woordenlijst is ongeldig.');
	const data = await fetchJson(fetchFn, `${trimSlash(baseUrl)}/lists/${encodeURIComponent(file)}`);
	return parseLibraryList(data);
}

export function libraryStatus(entry: LibraryEntry, installed?: WordList): LibraryStatus {
	if (!installed || installed.origin !== 'library') return 'not-installed';
	return installed.version < entry.version ? 'update-available' : 'installed';
}

function sameContent(a: Item, b: Item): boolean {
	return (
		a.term === b.term &&
		a.translation === b.translation &&
		a.example === b.example &&
		a.alternatives.length === b.alternatives.length &&
		a.alternatives.every((alt, i) => alt === b.alternatives[i])
	);
}

/** Voegt een bibliotheeklijst toe of werkt hem bij. Voortgang blijft bestaan zolang het item-id bestaat. */
export async function installLibraryList(
	store: Store,
	file: LibraryListFile,
	now: number
): Promise<{ added: number; updated: number; removed: number }> {
	const data = parseLibraryList(file);
	const existing = await store.lists.get(data.id);
	if (existing && existing.origin !== 'library') {
		throw new Error('Er bestaat al een eigen woordenlijst met hetzelfde id. De bibliotheeklijst is niet toegevoegd.');
	}

	const current = new Map((await store.items.byList(data.id)).map((item) => [item.id, item]));
	const incomingIds = new Set<string>();
	const toPut: Item[] = [];
	let added = 0;
	let updated = 0;

	for (const src of data.items) {
		const item: Item = {
			id: `${data.id}/${src.id}`,
			listId: data.id,
			term: src.term,
			translation: src.translation,
			alternatives: src.alternatives ?? [],
			updatedAt: now
		};
		if (src.example !== undefined) item.example = src.example;
		incomingIds.add(item.id);
		const old = current.get(item.id);
		if (!old) {
			added++;
			toPut.push(item);
		} else if (!sameContent(old, item)) {
			updated++;
			toPut.push(item);
		}
	}

	const list: WordList = {
		id: data.id,
		title: data.title,
		source: languageName(data.source),
		target: languageName(data.target),
		origin: 'library',
		version: data.version,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now
	};

	await store.lists.put(list);
	if (toPut.length > 0) await store.items.bulkPut(toPut);
	let removed = 0;
	for (const id of current.keys()) {
		if (!incomingIds.has(id)) {
			await store.items.delete(id);
			removed++;
		}
	}
	return { added, updated, removed };
}
