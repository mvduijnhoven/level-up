import {
	DEFAULT_INTERVALS_DAYS,
	MAX_BOX,
	type AnswerResult,
	type Direction,
	type Mastery,
	type Progress
} from './types.ts';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_INTERVAL_DAYS = 365;
export const INTERVAL_COUNT = 5;

/** 0 = nieuw, 1-2 = geoefend, 3-4 = bekend, 5 = beheerst. */
export function masteryOfBox(box: number): Mastery {
	if (box >= MAX_BOX) return 'mastered';
	if (box >= 3) return 'known';
	if (box >= 1) return 'practiced';
	return 'new';
}

export interface AnswerContext {
	itemId: string;
	listId: string;
	direction: Direction;
}

function intervalMs(box: number, intervalsDays: readonly number[]): number {
	const index = Math.min(Math.max(box, 1), MAX_BOX) - 1;
	const days = intervalsDays[index] ?? DEFAULT_INTERVALS_DAYS[index];
	return days * DAY_MS;
}

/**
 * Leitner-overgang voor één antwoord.
 * - goed: één bakje vooruit (max 5), volgende herhaling na het interval van het nieuwe bakje
 * - fout: terug naar bakje 1, volgende herhaling na het interval van bakje 1
 * - bijna goed: bakje blijft gelijk (bakje 0 blijft 0 zonder planning), interval van het huidige bakje
 * Een gewijzigd interval geldt pas vanaf dit antwoord; eerder geplande datums veranderen niet.
 */
export function applyAnswer(
	prev: Progress | undefined,
	ctx: AnswerContext,
	result: AnswerResult,
	now: number,
	intervalsDays: readonly number[]
): Progress {
	const base: Progress = prev ?? {
		itemId: ctx.itemId,
		listId: ctx.listId,
		direction: ctx.direction,
		box: 0,
		dueAt: null,
		correct: 0,
		almost: 0,
		wrong: 0,
		lastPracticedAt: null,
		updatedAt: now
	};

	let box = base.box;
	let dueAt: number | null;
	if (result === 'correct') {
		box = Math.min(base.box + 1, MAX_BOX);
		dueAt = now + intervalMs(box, intervalsDays);
	} else if (result === 'wrong') {
		box = 1;
		dueAt = now + intervalMs(1, intervalsDays);
	} else if (base.box === 0) {
		dueAt = null;
	} else {
		dueAt = now + intervalMs(base.box, intervalsDays);
	}

	return {
		...base,
		itemId: ctx.itemId,
		listId: ctx.listId,
		direction: ctx.direction,
		box,
		dueAt,
		correct: base.correct + (result === 'correct' ? 1 : 0),
		almost: base.almost + (result === 'almost' ? 1 : 0),
		wrong: base.wrong + (result === 'wrong' ? 1 : 0),
		lastPracticedAt: now,
		updatedAt: now
	};
}

/** Nooit geoefend (geen voortgang of bakje 0). */
export function isNew(p: Progress | undefined): boolean {
	return !p || p.box === 0;
}

/** Aan herhaling toe: al geoefend en de geplande datum is bereikt. Nieuwe items zijn niet "due". */
export function isDue(p: Progress | undefined, now: number): boolean {
	return !!p && p.box >= 1 && p.dueAt !== null && p.dueAt <= now;
}

/** Geeft een Nederlandse foutmelding, of null als de intervallen geldig zijn. */
export function validateIntervals(days: number[]): string | null {
	if (!Array.isArray(days) || days.length !== INTERVAL_COUNT) {
		return `Vul precies ${INTERVAL_COUNT} intervallen in, één per bakje.`;
	}
	for (const d of days) {
		if (typeof d !== 'number' || !Number.isInteger(d)) {
			return 'Gebruik hele aantallen dagen.';
		}
		if (d < 1) return 'Elk interval is minimaal 1 dag.';
		if (d > MAX_INTERVAL_DAYS) return `Een interval is maximaal ${MAX_INTERVAL_DAYS} dagen.`;
	}
	for (let i = 1; i < days.length; i++) {
		if (days[i] <= days[i - 1]) {
			return 'Elk bakje moet een langer interval hebben dan het vorige.';
		}
	}
	return null;
}

/**
 * Maakt van willekeurige invoer een geldige reeks: afgerond, begrensd op 1..365, strikt oplopend
 * en altijd 5 waarden (ontbrekende waarden komen uit de standaardwaarden of het vorige bakje + 1).
 */
export function normalizeIntervals(days: readonly number[]): number[] {
	const out: number[] = [];
	for (let i = 0; i < INTERVAL_COUNT; i++) {
		const raw = Number(days[i]);
		let value = Number.isFinite(raw) ? Math.round(raw) : DEFAULT_INTERVALS_DAYS[i];
		value = Math.min(Math.max(value, 1), MAX_INTERVAL_DAYS);
		if (i > 0 && value <= out[i - 1]) value = out[i - 1] + 1;
		out.push(value);
	}
	// Bovenaan begrensd: schuif de staart terug zodat de reeks strikt oplopend blijft.
	for (let i = INTERVAL_COUNT - 1; i >= 0; i--) {
		const max = MAX_INTERVAL_DAYS - (INTERVAL_COUNT - 1 - i);
		if (out[i] > max) out[i] = max;
	}
	return out;
}

/** Aantal items per beheersingsniveau; items zonder voortgang tellen als nieuw. */
export function countMastery(
	items: { id: string }[],
	progress: Progress[]
): Record<Mastery, number> {
	const boxById = new Map<string, number>();
	for (const p of progress) boxById.set(p.itemId, p.box);
	const counts: Record<Mastery, number> = { new: 0, practiced: 0, known: 0, mastered: 0 };
	for (const item of items) counts[masteryOfBox(boxById.get(item.id) ?? 0)]++;
	return counts;
}
