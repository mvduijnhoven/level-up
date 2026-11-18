export type Delimiter = 'tab' | 'comma' | 'equals';

export interface ParsedItem {
	term: string;
	translation: string;
	alternatives: string[];
	example?: string;
}

export interface ParseError {
	line: number;
	message: string;
}

export interface ParseResult {
	items: ParsedItem[];
	errors: ParseError[];
	delimiter: Delimiter | null;
	/** Aantal dubbele regels (zelfde term en vertaling) dat is overgeslagen. */
	duplicates: number;
}

const DELIMITER_CHAR: Record<Delimiter, string> = { tab: '\t', comma: ',', equals: '=' };
const DELIMITER_NAME: Record<Delimiter, string> = {
	tab: 'een tab',
	comma: 'een komma',
	equals: 'een =-teken'
};
/** Volgorde bij gelijke aantallen. */
const DETECTION_ORDER: Delimiter[] = ['tab', 'equals', 'comma'];

interface SplitResult {
	fields: string[];
	/** Een aanhalingsteken is aan het eind van de regel nog niet gesloten. */
	openQuote: boolean;
}

/** Splitst op het scheidingsteken; velden mogen tussen dubbele aanhalingstekens staan ("" = één aanhalingsteken). */
function splitFields(line: string, delim: string): SplitResult {
	const fields: string[] = [];
	let i = 0;
	while (true) {
		let j = i;
		while (j < line.length && line[j] === ' ') j++;
		if (line[j] === '"') {
			let value = '';
			let k = j + 1;
			let closed = false;
			while (k < line.length) {
				if (line[k] === '"') {
					if (line[k + 1] === '"') {
						value += '"';
						k += 2;
						continue;
					}
					closed = true;
					k++;
					break;
				}
				value += line[k++];
			}
			if (!closed) {
				fields.push(value);
				return { fields, openQuote: true };
			}
			// Tekst na het sluitende aanhalingsteken tot het scheidingsteken blijft behouden.
			let tail = '';
			while (k < line.length && line[k] !== delim) tail += line[k++];
			fields.push(value + tail.trimEnd());
			if (k >= line.length) return { fields, openQuote: false };
			i = k + 1;
		} else {
			const next = line.indexOf(delim, i);
			if (next === -1) {
				fields.push(line.slice(i));
				return { fields, openQuote: false };
			}
			fields.push(line.slice(i, next));
			i = next + 1;
		}
	}
}

function detectDelimiter(lines: string[]): Delimiter | null {
	let best: Delimiter | null = null;
	let bestCount = 0;
	for (const delimiter of DETECTION_ORDER) {
		const char = DELIMITER_CHAR[delimiter];
		let count = 0;
		for (const line of lines) {
			if (splitFields(line, char).fields.length >= 2) count++;
		}
		if (count > bestCount) {
			best = delimiter;
			bestCount = count;
		}
	}
	return best;
}

interface LogicalRecord {
	line: number;
	text: string;
	fields: string[] | null;
	unclosed: boolean;
}

/** Voegt fysieke regels samen als een tussen aanhalingstekens staand veld over meerdere regels loopt. */
function buildRecords(lines: string[], delimiter: Delimiter | null): LogicalRecord[] {
	const char = delimiter ? DELIMITER_CHAR[delimiter] : '\t';
	const records: LogicalRecord[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (lines[i].trim() === '') continue;
		let text = lines[i];
		let split = splitFields(text, char);
		let end = i;
		while (split.openQuote && end + 1 < lines.length) {
			end++;
			text += '\n' + lines[end];
			split = splitFields(text, char);
		}
		if (split.openQuote) {
			records.push({ line: i + 1, text: lines[i], fields: null, unclosed: true });
			continue;
		}
		records.push({ line: i + 1, text, fields: split.fields, unclosed: false });
		i = end;
	}
	return records;
}

function splitTranslations(raw: string): string[] {
	return raw
		.split(/[|;]/)
		.map((part) => part.trim())
		.filter((part) => part !== '');
}

function duplicateKey(term: string, translation: string): string {
	return `${term.normalize('NFC').toLowerCase()}\u0000${translation.normalize('NFC').toLowerCase()}`;
}

export function parseWordList(text: string): ParseResult {
	const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
	const delimiter = detectDelimiter(lines.filter((l) => l.trim() !== ''));
	const records = buildRecords(lines, delimiter);

	const items: ParsedItem[] = [];
	const errors: ParseError[] = [];
	const seen = new Set<string>();
	let duplicates = 0;

	for (const record of records) {
		if (record.unclosed || !record.fields) {
			errors.push({ line: record.line, message: 'Een aanhalingsteken is niet gesloten.' });
			continue;
		}
		const fields = record.fields.map((f) => f.trim());
		if (!delimiter || fields.length < 2) {
			const expected = delimiter ? DELIMITER_NAME[delimiter] : 'een tab, komma of =-teken';
			errors.push({
				line: record.line,
				message: `Geen scheidingsteken gevonden. Zet ${expected} tussen het woord en de vertaling.`
			});
			continue;
		}
		const term = fields[0];
		const translations = splitTranslations(fields[1]);
		if (term === '') {
			errors.push({ line: record.line, message: 'Het woord ontbreekt.' });
			continue;
		}
		if (translations.length === 0) {
			errors.push({ line: record.line, message: 'De vertaling ontbreekt.' });
			continue;
		}
		const [translation, ...rest] = translations;
		const alternatives = [...new Set(rest)].filter((a) => a !== translation);
		const example = record.fields.slice(2).join(DELIMITER_CHAR[delimiter]).trim();

		const key = duplicateKey(term, translation);
		if (seen.has(key)) {
			duplicates++;
			continue;
		}
		seen.add(key);

		const item: ParsedItem = { term, translation, alternatives };
		if (example !== '') item.example = example;
		items.push(item);
	}

	return { items, errors, delimiter, duplicates };
}

function cleanField(value: string): string {
	const flat = value.replace(/[\t\r\n]+/g, ' ').trim();
	// Een veld dat met een aanhalingsteken begint, moet gequote worden om terug te kunnen lezen.
	return flat.startsWith('"') ? `"${flat.replace(/"/g, '""')}"` : flat;
}

/** Tab-gescheiden tekst (woord, vertalingen met `|`, voorbeeldzin) die `parseWordList` weer kan lezen. */
export function serializeWordList(
	items: {
		term: string;
		translation: string;
		alternatives?: string[];
		example?: string;
	}[]
): string {
	return items
		.map((item) => {
			const translations = [item.translation, ...(item.alternatives ?? [])]
				.map(cleanField)
				.join(' | ');
			const columns = [cleanField(item.term), translations];
			if (item.example && item.example.trim() !== '') columns.push(cleanField(item.example));
			return columns.join('\t');
		})
		.join('\n');
}
