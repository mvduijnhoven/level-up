import { describe, expect, it } from 'vitest';
import { levelFromXp, xpForAnswer, type XpInput } from './xp.ts';

const base: XpInput = {
	result: 'correct',
	boxBefore: 1,
	overdue: false,
	mode: 'learn',
	combo: 0,
	form: 'typing',
	repeatInSession: false
};
const xp = (o: Partial<XpInput>) => xpForAnswer({ ...base, ...o });

describe('xpForAnswer', () => {
	it('geeft basis-XP per vorm en resultaat', () => {
		expect(xp({})).toBe(10);
		expect(xp({ form: 'choice' })).toBe(6);
		expect(xp({ result: 'almost' })).toBe(4);
		expect(xp({ result: 'wrong' })).toBe(0);
	});

	it('geeft +50% voor moeilijke of achterstallige items, afgerond', () => {
		expect(xp({ boxBefore: 3 })).toBe(15);
		expect(xp({ overdue: true })).toBe(15);
		expect(xp({ boxBefore: 4, form: 'choice' })).toBe(9);
		expect(xp({ boxBefore: 5, result: 'almost' })).toBe(6);
		expect(xp({ boxBefore: 2 })).toBe(10);
	});

	it('geeft nieuwe items (bakje 0) nooit de bonus', () => {
		expect(xp({ boxBefore: 0, overdue: true })).toBe(10);
	});

	it('geeft de combo-bonus alleen in speedrun en alleen bij goed, max +5', () => {
		expect(xp({ mode: 'speedrun', combo: 4 })).toBe(10);
		expect(xp({ mode: 'speedrun', combo: 5 })).toBe(11);
		expect(xp({ mode: 'speedrun', combo: 14 })).toBe(12);
		expect(xp({ mode: 'speedrun', combo: 500 })).toBe(15);
		expect(xp({ mode: 'learn', combo: 25 })).toBe(10);
		expect(xp({ mode: 'speedrun', combo: 25, result: 'almost' })).toBe(4);
	});

	it('begrenst herhaling in dezelfde sessie op 2 XP, ook met bonussen', () => {
		expect(xp({ repeatInSession: true })).toBe(2);
		expect(xp({ repeatInSession: true, boxBefore: 5, mode: 'speedrun', combo: 30 })).toBe(2);
		expect(xp({ repeatInSession: true, result: 'wrong' })).toBe(0);
	});
});

describe('levelFromXp', () => {
	it('begint op niveau 1 met een niveau van 50 XP', () => {
		expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 50, progress: 0 });
		expect(levelFromXp(25).progress).toBe(0.5);
	});

	it('gaat op de grens naar het volgende niveau (kosten 50, 75, 100, ...)', () => {
		expect(levelFromXp(49).level).toBe(1);
		expect(levelFromXp(50)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNextLevel: 75 });
		expect(levelFromXp(124)).toMatchObject({ level: 2, xpIntoLevel: 74 });
		expect(levelFromXp(125)).toMatchObject({ level: 3, xpForNextLevel: 100 });
	});

	it('is veilig bij negatieve of ongeldige invoer', () => {
		expect(levelFromXp(-10).level).toBe(1);
		expect(levelFromXp(Number.NaN).level).toBe(1);
	});

	it('is monotoon en houdt progress binnen [0, 1)', () => {
		let last = 1;
		for (let x = 0; x < 20_000; x += 37) {
			const l = levelFromXp(x);
			expect(l.level).toBeGreaterThanOrEqual(last);
			expect(l.progress).toBeGreaterThanOrEqual(0);
			expect(l.progress).toBeLessThan(1);
			last = l.level;
		}
	});
});
