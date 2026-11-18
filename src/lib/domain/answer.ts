import type { AnswerResult, Direction, Item } from './types.ts';

export type AnswerReason = 'accent' | 'case' | 'typo' | 'article' | 'punctuation';

export interface AnswerCheck {
	result: AnswerResult;
	/** Het geaccepteerde antwoord waarmee het antwoord het best overeenkomt; null bij fout. */
	matched: string | null;
	/** Alleen bij 'almost': wat er mis was. */
	reason?: AnswerReason;
	/** Het antwoord om te tonen: bij goed/bijna goed het gematchte antwoord, anders het eerste geaccepteerde. */
	expected: string;
}

export interface CheckOptions {
	/** true = een ander of ontbrekend accent geeft 'almost'; false = accenten worden genegeerd. */
	strictAccents?: boolean;
}

const ARTICLES = new Set([
	'la',
	'le',
	'les',
	'un',
	'une',
	'des',
	'de',
	'het',
	'een',
	'the',
	'a',
	'an',
	'der',
	'die',
	'das',
	'ein',
	'eine',
	'el',
	'los',
	'las',
	'una'
]);

/** NFC, apostrofvarianten gelijk, witruimte samengevoegd, kleine letters, eindleestekens weg. */
function normalize(text: string): string {
	return text
		.normalize('NFC')
		.replace(/[’‘`´]/g, "'")
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase()
		.replace(/^[¿¡]+/, '')
		.replace(/[.!?…]+$/, '')
		.trim();
}

function fold(text: string): string {
	return text.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

/** Splitst een voorafgaand lidwoord af, mits er daarna nog tekst overblijft. */
function splitArticle(text: string): { article: string; rest: string } {
	const elided = /^(l')(.+)$/.exec(text);
	if (elided) return { article: elided[1], rest: elided[2].trim() };
	const space = text.indexOf(' ');
	if (space > 0 && ARTICLES.has(text.slice(0, space))) {
		const rest = text.slice(space + 1).trim();
		if (rest) return { article: text.slice(0, space), rest };
	}
	return { article: '', rest: text };
}

/** Damerau-Levenshtein (optimal string alignment): een omwisseling van twee letters kost 1. */
export function editDistance(a: string, b: string): number {
	const x = Array.from(a);
	const y = Array.from(b);
	const rows = x.length + 1;
	const cols = y.length + 1;
	const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
	for (let i = 0; i < rows; i++) d[i][0] = i;
	for (let j = 0; j < cols; j++) d[0][j] = j;
	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			const cost = x[i - 1] === y[j - 1] ? 0 : 1;
			d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) {
				d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
			}
		}
	}
	return d[rows - 1][cols - 1];
}

/** Toegestane afstand: geen tolerantie onder 5 tekens, 1 vanaf 5, 2 vanaf 10. */
function typoTolerance(length: number): number {
	if (length >= 10) return 2;
	if (length >= 5) return 1;
	return 0;
}

interface Judgement {
	result: AnswerResult;
	reason?: AnswerReason;
}

function judge(given: string, expected: string, strict: boolean): Judgement {
	if (given === expected) return { result: 'correct' };

	const givenFolded = fold(given);
	const expectedFolded = fold(expected);
	if (givenFolded === expectedFolded) {
		return strict ? { result: 'almost', reason: 'accent' } : { result: 'correct' };
	}

	const g = splitArticle(given);
	const e = splitArticle(expected);
	if (e.article !== '' && g.article === '' && fold(e.rest) === givenFolded) {
		return { result: 'almost', reason: 'article' };
	}

	// Een ander lidwoord is een echte fout (la/le), dus daar geldt geen typo-tolerantie.
	if (g.article !== e.article) return { result: 'wrong' };
	const a = strict ? g.rest : fold(g.rest);
	const b = strict ? e.rest : fold(e.rest);
	const tolerance = typoTolerance(Math.min(Array.from(a).length, Array.from(b).length));
	if (tolerance > 0 && editDistance(a, b) <= tolerance) {
		return { result: 'almost', reason: 'typo' };
	}
	return { result: 'wrong' };
}

const RANK: Record<AnswerResult, number> = { correct: 0, almost: 1, wrong: 2 };

export function checkAnswer(
	input: string,
	accepted: string[],
	opts: CheckOptions = {}
): AnswerCheck {
	const strict = opts.strictAccents ?? false;
	const candidates = accepted.filter((a) => a.trim() !== '');
	const fallback = candidates[0] ?? '';
	const given = normalize(input);
	if (given === '') return { result: 'wrong', matched: null, expected: fallback };

	let best: { judgement: Judgement; answer: string } | null = null;
	for (const answer of candidates) {
		const expected = normalize(answer);
		if (expected === '') continue;
		const judgement = judge(given, expected, strict);
		if (!best || RANK[judgement.result] < RANK[best.judgement.result]) {
			best = { judgement, answer };
			if (judgement.result === 'correct') break;
		}
	}

	if (!best || best.judgement.result === 'wrong') {
		return { result: 'wrong', matched: null, expected: fallback };
	}
	const { result, reason } = best.judgement;
	return reason
		? { result, matched: best.answer, reason, expected: best.answer }
		: { result, matched: best.answer, expected: best.answer };
}

/** Vraagtekst en geaccepteerde antwoorden voor een item in een richting. */
export function expandAccepted(
	item: Pick<Item, 'term' | 'translation' | 'alternatives'>,
	direction: Direction
): { prompt: string; accepted: string[] } {
	if (direction === 'backward') {
		return { prompt: item.translation, accepted: [item.term] };
	}
	const accepted: string[] = [];
	const seen = new Set<string>();
	for (const answer of [item.translation, ...item.alternatives]) {
		const key = normalize(answer);
		if (key === '' || seen.has(key)) continue;
		seen.add(key);
		accepted.push(answer);
	}
	return { prompt: item.term, accepted };
}

export interface DiffSegment {
	text: string;
	mismatch: boolean;
}

/**
 * Markeert in de verwachte tekst welke tekens niet in het gegeven antwoord voorkomen
 * (langste gemeenschappelijke deelreeks; hoofdletters tellen niet mee, accenten wel).
 */
export function diffMarkup(expected: string, given: string): DiffSegment[] {
	const exp = Array.from(expected.normalize('NFC'));
	const giv = Array.from(given.normalize('NFC').replace(/\s+/g, ' ').trim());
	if (exp.length === 0) return [];

	const lower = (c: string) => c.toLowerCase();
	const rows = exp.length + 1;
	const cols = giv.length + 1;
	const lcs: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
	for (let i = exp.length - 1; i >= 0; i--) {
		for (let j = giv.length - 1; j >= 0; j--) {
			lcs[i][j] =
				lower(exp[i]) === lower(giv[j])
					? lcs[i + 1][j + 1] + 1
					: Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}

	const matched = new Array<boolean>(exp.length).fill(false);
	let i = 0;
	let j = 0;
	while (i < exp.length && j < giv.length) {
		if (lower(exp[i]) === lower(giv[j])) {
			matched[i] = true;
			i++;
			j++;
		} else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
			i++;
		} else {
			j++;
		}
	}

	const segments: DiffSegment[] = [];
	for (let k = 0; k < exp.length; k++) {
		const mismatch = !matched[k];
		const last = segments[segments.length - 1];
		if (last && last.mismatch === mismatch) last.text += exp[k];
		else segments.push({ text: exp[k], mismatch });
	}
	return segments;
}
