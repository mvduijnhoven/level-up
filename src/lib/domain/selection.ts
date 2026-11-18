import { isDue, isNew } from './leitner.ts';
import type { Direction, Item, Progress, SessionDirection } from './types.ts';

export const SPEEDRUN_MIN_POOL = 5;
export const DEFAULT_SESSION_SIZE = 10;
export const DEFAULT_NEW_PER_SESSION = 5;
const DEFAULT_CHOICE_COUNT = 4;
/** Grootte van de blokken waarbinnen de volgorde van een leersessie wordt geschud. */
const SHUFFLE_WINDOW = 4;

export interface Candidate {
	item: Item;
	direction: Direction;
	progress: Progress | undefined;
}

/** Deterministische pseudo-willekeur in [0, 1), bedoeld voor tests. */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Fisher-Yates; geeft een nieuwe array en laat de invoer ongemoeid. */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
	const out = arr.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Eén kandidaat per item en richting, met de bijbehorende voortgang, in willekeurige volgorde. */
export function buildCandidates(
	items: Item[],
	progress: Progress[],
	direction: SessionDirection,
	rng: () => number
): Candidate[] {
	const byKey = new Map<string, Progress>();
	for (const p of progress) byKey.set(`${p.itemId}|${p.direction}`, p);
	const directions: Direction[] = direction === 'both' ? ['forward', 'backward'] : [direction];
	const out: Candidate[] = [];
	for (const item of items) {
		for (const d of directions) {
			out.push({ item, direction: d, progress: byKey.get(`${item.id}|${d}`) });
		}
	}
	return shuffle(out, rng);
}

function shuffleWithinWindows<T>(arr: T[], rng: () => number): T[] {
	const out: T[] = [];
	for (let i = 0; i < arr.length; i += SHUFFLE_WINDOW) {
		out.push(...shuffle(arr.slice(i, i + SHUFFLE_WINDOW), rng));
	}
	return out;
}

/**
 * Kiest de items voor een leersessie: eerst achterstallige (oudste dueAt eerst), dan nieuwe
 * (maximaal `newPerSession`), daarna de rest op laagste bakje en vroegste dueAt, tot `size`.
 * De gekozen reeks wordt per blok van vier geschud, zodat de prioriteit grofweg behouden blijft.
 */
export function selectLearnSession(
	cands: Candidate[],
	now: number,
	opts: { size?: number; newPerSession?: number },
	rng: () => number
): Candidate[] {
	const size = opts.size ?? DEFAULT_SESSION_SIZE;
	const newLimit = opts.newPerSession ?? DEFAULT_NEW_PER_SESSION;
	if (size <= 0) return [];

	const seen = new Set<string>();
	const unique = cands.filter((c) => {
		const key = `${c.item.id}|${c.direction}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	const dueTime = (c: Candidate) => c.progress?.dueAt ?? Number.POSITIVE_INFINITY;
	const due = unique
		.filter((c) => isDue(c.progress, now))
		.sort((a, b) => dueTime(a) - dueTime(b));
	const fresh = unique.filter((c) => isNew(c.progress)).slice(0, Math.max(0, newLimit));
	const rest = unique
		.filter((c) => !isNew(c.progress) && !isDue(c.progress, now))
		.sort((a, b) => a.progress!.box - b.progress!.box || dueTime(a) - dueTime(b));

	const picked = [...due, ...fresh, ...rest].slice(0, size);
	return shuffleWithinWindows(picked, rng);
}

/** Alleen items die in deze richting al minimaal één keer zijn geoefend (SM-05). */
export function selectSpeedrunPool(cands: Candidate[]): Candidate[] {
	return cands.filter((c) => c.progress !== undefined && c.progress.box >= 1);
}

export function canPlaySpeedrun(cands: Candidate[]): boolean {
	return selectSpeedrunPool(cands).length >= SPEEDRUN_MIN_POOL;
}

function answerKey(text: string): string {
	return text.normalize('NFC').trim().toLowerCase();
}

/**
 * Meerkeuzeopties voor `target`. Afleiders komen uit `pool`, zijn uniek en gelijken niet op het
 * juiste antwoord of een alternatief daarvan. Geeft een lege lijst als er minder dan 2 opties
 * te maken zijn; de aanroeper kan dan een typvraag stellen.
 */
export function buildChoices(
	target: Item,
	pool: Item[],
	direction: Direction,
	count: number = DEFAULT_CHOICE_COUNT,
	rng: () => number
): { options: string[]; correctIndex: number } {
	const answerOf = (item: Item) => (direction === 'forward' ? item.translation : item.term);
	const correct = answerOf(target);
	const excluded = new Set([answerKey(correct)]);
	if (direction === 'forward') for (const alt of target.alternatives) excluded.add(answerKey(alt));

	const distractors: string[] = [];
	for (const item of shuffle(pool, rng)) {
		if (distractors.length >= count - 1) break;
		if (item.id === target.id) continue;
		const text = answerOf(item);
		const key = answerKey(text);
		if (key === '' || excluded.has(key)) continue;
		excluded.add(key);
		distractors.push(text);
	}

	if (distractors.length === 0 || count < 2) return { options: [], correctIndex: -1 };
	const options = shuffle([correct, ...distractors], rng);
	return { options, correctIndex: options.indexOf(correct) };
}
