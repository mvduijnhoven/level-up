import { describe, expect, it } from 'vitest';
import {
	DAY_MS,
	applyAnswer,
	countMastery,
	isDue,
	isNew,
	masteryOfBox,
	normalizeIntervals,
	validateIntervals
} from './leitner.ts';
import { DEFAULT_INTERVALS_DAYS, type Progress } from './types.ts';

const ctx = { itemId: 'i1', listId: 'l1', direction: 'forward' as const };
const NOW = 1_000_000_000_000;

function at(box: number, extra: Partial<Progress> = {}): Progress {
	return {
		itemId: 'i1',
		listId: 'l1',
		direction: 'forward',
		box,
		dueAt: box === 0 ? null : NOW,
		correct: 0,
		almost: 0,
		wrong: 0,
		lastPracticedAt: null,
		updatedAt: 0,
		...extra
	};
}

describe('masteryOfBox', () => {
	it('koppelt bakjes aan niveaus', () => {
		expect([0, 1, 2, 3, 4, 5].map(masteryOfBox)).toEqual([
			'new',
			'practiced',
			'practiced',
			'known',
			'known',
			'mastered'
		]);
	});
});

describe('applyAnswer', () => {
	it('maakt bij het eerste goede antwoord bakje 1 met interval van 1 dag', () => {
		const p = applyAnswer(undefined, ctx, 'correct', NOW, DEFAULT_INTERVALS_DAYS);
		expect(p).toMatchObject({ box: 1, dueAt: NOW + DAY_MS, correct: 1, lastPracticedAt: NOW });
	});

	it('gaat per goed antwoord een bakje omhoog met het interval van het nieuwe bakje', () => {
		const p = applyAnswer(at(2), ctx, 'correct', NOW, DEFAULT_INTERVALS_DAYS);
		expect(p.box).toBe(3);
		expect(p.dueAt).toBe(NOW + 7 * DAY_MS);
	});

	it('blijft in bakje 5 met het interval van 30 dagen', () => {
		const p = applyAnswer(at(5), ctx, 'correct', NOW, DEFAULT_INTERVALS_DAYS);
		expect(p.box).toBe(5);
		expect(p.dueAt).toBe(NOW + 30 * DAY_MS);
	});

	it('zet een fout antwoord terug naar bakje 1, ook vanuit bakje 5 of 0', () => {
		for (const box of [0, 3, 5]) {
			const p = applyAnswer(at(box), ctx, 'wrong', NOW, DEFAULT_INTERVALS_DAYS);
			expect(p.box).toBe(1);
			expect(p.dueAt).toBe(NOW + DAY_MS);
			expect(p.wrong).toBe(1);
		}
	});

	it('houdt bij bijna goed het bakje vast en plant met het huidige interval', () => {
		const p = applyAnswer(at(3), ctx, 'almost', NOW, DEFAULT_INTERVALS_DAYS);
		expect(p).toMatchObject({ box: 3, dueAt: NOW + 7 * DAY_MS, almost: 1 });
	});

	it('houdt een nieuw item bij bijna goed nieuw zonder planning', () => {
		const p = applyAnswer(undefined, ctx, 'almost', NOW, DEFAULT_INTERVALS_DAYS);
		expect(p).toMatchObject({ box: 0, dueAt: null, almost: 1, lastPracticedAt: NOW });
		expect(isNew(p)).toBe(true);
	});

	it('telt op en wijzigt de invoer niet', () => {
		const prev = at(1, { correct: 2, wrong: 1 });
		const copy = { ...prev };
		const p = applyAnswer(prev, ctx, 'correct', NOW + 5, [2, 4, 8, 16, 32]);
		expect(prev).toEqual(copy);
		expect(p).toMatchObject({ correct: 3, wrong: 1, box: 2, updatedAt: NOW + 5 });
		expect(p.dueAt).toBe(NOW + 5 + 4 * DAY_MS);
	});
});

describe('isDue / isNew', () => {
	it('beschouwt nooit geoefende items als nieuw, niet als due', () => {
		expect(isDue(undefined, NOW)).toBe(false);
		expect(isNew(undefined)).toBe(true);
		expect(isDue(at(0), NOW)).toBe(false);
	});

	it('is due vanaf het geplande tijdstip', () => {
		expect(isDue(at(2, { dueAt: NOW }), NOW)).toBe(true);
		expect(isDue(at(2, { dueAt: NOW + 1 }), NOW)).toBe(false);
		expect(isNew(at(2))).toBe(false);
	});
});

describe('validateIntervals', () => {
	it('accepteert de standaardwaarden', () => {
		expect(validateIntervals([...DEFAULT_INTERVALS_DAYS])).toBeNull();
	});

	it.each([
		[[1, 3, 7, 14]],
		[[1, 3, 7, 14, 30, 60]],
		[[0, 3, 7, 14, 30]],
		[[1, 2.5, 7, 14, 30]],
		[[1, 3, 3, 14, 30]],
		[[5, 3, 7, 14, 30]],
		[[1, 3, 7, 14, 366]]
	])('weigert %j met een melding', (days) => {
		expect(validateIntervals(days)).toEqual(expect.any(String));
	});

	it('staat 365 toe', () => {
		expect(validateIntervals([1, 2, 3, 4, 365])).toBeNull();
	});
});

describe('normalizeIntervals', () => {
	it('herstelt tot een geldige, oplopende reeks van 5', () => {
		for (const input of [[], [0, 0, 0], [10, 5, 5, 400, 1000], [NaN, 2.4, 2.6], [365, 365, 365, 365, 365]]) {
			expect(validateIntervals(normalizeIntervals(input))).toBeNull();
		}
		expect(normalizeIntervals([2, 5, 9, 20, 40])).toEqual([2, 5, 9, 20, 40]);
		expect(normalizeIntervals([3, 3])).toEqual([3, 4, 7, 14, 30]);
	});
});

describe('countMastery', () => {
	it('telt items zonder voortgang als nieuw', () => {
		const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
		const progress = [
			at(2, { itemId: 'a' }),
			at(4, { itemId: 'b' }),
			at(5, { itemId: 'c' }),
			at(0, { itemId: 'd' })
		];
		expect(countMastery(items, progress)).toEqual({
			new: 2,
			practiced: 1,
			known: 1,
			mastered: 1
		});
	});

	it('negeert voortgang van items die niet in de lijst zitten', () => {
		expect(countMastery([{ id: 'a' }], [at(5, { itemId: 'x' })]).mastered).toBe(0);
	});
});
