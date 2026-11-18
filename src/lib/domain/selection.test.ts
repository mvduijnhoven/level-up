import { describe, expect, it } from 'vitest';
import { DAY_MS } from './leitner.ts';
import {
	SPEEDRUN_MIN_POOL,
	buildCandidates,
	buildChoices,
	canPlaySpeedrun,
	mulberry32,
	selectLearnSession,
	selectSpeedrunPool,
	shuffle,
	type Candidate
} from './selection.ts';
import type { Item, Progress } from './types.ts';

const NOW = 1_000_000_000_000;

function item(id: string, translation = `t-${id}`, extra: Partial<Item> = {}): Item {
	return { id, listId: 'l', term: `w-${id}`, translation, alternatives: [], updatedAt: 0, ...extra };
}

function prog(it: Item, box: number, dueAt: number | null, direction: 'forward' | 'backward' = 'forward'): Progress {
	return {
		itemId: it.id,
		listId: 'l',
		direction,
		box,
		dueAt,
		correct: 0,
		almost: 0,
		wrong: 0,
		lastPracticedAt: null,
		updatedAt: 0
	};
}

const cand = (it: Item, p?: Progress, direction: 'forward' | 'backward' = 'forward'): Candidate => ({
	item: it,
	direction,
	progress: p
});

describe('shuffle / mulberry32', () => {
	it('is deterministisch per seed en muteert de invoer niet', () => {
		const input = [1, 2, 3, 4, 5, 6, 7, 8];
		const a = shuffle(input, mulberry32(42));
		const b = shuffle(input, mulberry32(42));
		expect(a).toEqual(b);
		expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		expect([...a].sort()).toEqual(input);
		expect(a).not.toEqual(input);
	});

	it('geeft waarden in [0, 1)', () => {
		const rng = mulberry32(7);
		for (let i = 0; i < 1000; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('buildCandidates', () => {
	const items = [item('a'), item('b')];
	const progress = [prog(items[0], 2, NOW, 'forward'), prog(items[0], 4, NOW, 'backward')];

	it('maakt één kandidaat per item voor één richting', () => {
		const c = buildCandidates(items, progress, 'forward', mulberry32(1));
		expect(c).toHaveLength(2);
		expect(c.every((x) => x.direction === 'forward')).toBe(true);
		expect(c.find((x) => x.item.id === 'a')?.progress?.box).toBe(2);
	});

	it('gebruikt bij both per richting de eigen voortgang', () => {
		const c = buildCandidates(items, progress, 'both', mulberry32(1));
		expect(c).toHaveLength(4);
		const byKey = (id: string, d: string) => c.find((x) => x.item.id === id && x.direction === d);
		expect(byKey('a', 'forward')?.progress?.box).toBe(2);
		expect(byKey('a', 'backward')?.progress?.box).toBe(4);
		expect(byKey('b', 'backward')?.progress).toBeUndefined();
	});
});

describe('selectLearnSession', () => {
	const rng = () => mulberry32(3);

	it('kiest eerst achterstallige items (oudste eerst), dan nieuwe, dan de rest', () => {
		const old = item('old');
		const late = item('late');
		const fresh = [item('n1'), item('n2')];
		const later = item('later');
		const cands = [
			cand(later, prog(later, 3, NOW + DAY_MS)),
			cand(fresh[0]),
			cand(late, prog(late, 2, NOW - 1000)),
			cand(fresh[1]),
			cand(old, prog(old, 4, NOW - 5000))
		];
		const out = selectLearnSession(cands, NOW, { size: 3, newPerSession: 5 }, rng());
		expect(out.map((c) => c.item.id).sort()).toEqual(['late', 'n1', 'old']);
	});

	it('beperkt het aantal nieuwe items tot newPerSession (standaard 5)', () => {
		const news = Array.from({ length: 12 }, (_, i) => cand(item(`n${i}`)));
		expect(selectLearnSession(news, NOW, {}, rng())).toHaveLength(5);
		expect(selectLearnSession(news, NOW, { newPerSession: 2, size: 10 }, rng())).toHaveLength(2);
		expect(selectLearnSession(news, NOW, { newPerSession: 0 }, rng())).toHaveLength(0);
	});

	it('vult aan met de rest op laagste bakje en vroegste dueAt, tot size', () => {
		const a = item('a');
		const b = item('b');
		const c = item('c');
		const d = item('d');
		const cands = [
			cand(a, prog(a, 4, NOW + 3 * DAY_MS)),
			cand(b, prog(b, 1, NOW + 2 * DAY_MS)),
			cand(c, prog(c, 1, NOW + 1 * DAY_MS)),
			cand(d, prog(d, 2, NOW + 1 * DAY_MS))
		];
		const out = selectLearnSession(cands, NOW, { size: 3 }, rng());
		expect(out.map((x) => x.item.id).sort()).toEqual(['b', 'c', 'd']);
	});

	it('laat achterstallige items voorgaan op nieuwe als de sessie vol is', () => {
		const dues = Array.from({ length: 4 }, (_, i) => {
			const it = item(`d${i}`);
			return cand(it, prog(it, 1, NOW - (i + 1)));
		});
		const cands = [...dues, cand(item('n1')), cand(item('n2'))];
		const out = selectLearnSession(cands, NOW, { size: 4 }, rng());
		expect(out.every((c) => c.item.id.startsWith('d'))).toBe(true);
	});

	it('kent geen duplicaten en behandelt beide richtingen van een item apart', () => {
		const a = item('a');
		const cands = [cand(a), cand(a), cand(a, undefined, 'backward')];
		const out = selectLearnSession(cands, NOW, { size: 10 }, rng());
		expect(out).toHaveLength(2);
	});

	it('behandelt een bijna-goed nieuw item (bakje 0, dueAt null) als nieuw', () => {
		const a = item('a');
		const out = selectLearnSession([cand(a, prog(a, 0, null))], NOW, { size: 5 }, rng());
		expect(out).toHaveLength(1);
	});

	it('houdt na het schudden de grove prioriteit: blokken van vier', () => {
		const dues = Array.from({ length: 4 }, (_, i) => {
			const it = item(`d${i}`);
			return cand(it, prog(it, 1, NOW - 1000 + i));
		});
		const rest = Array.from({ length: 4 }, (_, i) => {
			const it = item(`r${i}`);
			return cand(it, prog(it, 2, NOW + DAY_MS + i));
		});
		const out = selectLearnSession([...rest, ...dues], NOW, { size: 8 }, mulberry32(11));
		expect(out.slice(0, 4).every((c) => c.item.id.startsWith('d'))).toBe(true);
	});
});

describe('speedrun pool', () => {
	it('bevat alleen kandidaten met bakje >= 1 in die richting', () => {
		const items = Array.from({ length: 6 }, (_, i) => item(`i${i}`));
		const cands = [
			cand(items[0], prog(items[0], 1, NOW)),
			cand(items[1], prog(items[1], 0, null)),
			cand(items[2]),
			cand(items[3], prog(items[3], 5, NOW))
		];
		expect(selectSpeedrunPool(cands).map((c) => c.item.id)).toEqual(['i0', 'i3']);
	});

	it(`vereist minimaal ${SPEEDRUN_MIN_POOL} geoefende kandidaten`, () => {
		const make = (n: number) =>
			Array.from({ length: n }, (_, i) => {
				const it = item(`p${i}`);
				return cand(it, prog(it, 1, NOW));
			});
		expect(canPlaySpeedrun(make(SPEEDRUN_MIN_POOL - 1))).toBe(false);
		expect(canPlaySpeedrun(make(SPEEDRUN_MIN_POOL))).toBe(true);
	});
});

describe('buildChoices', () => {
	const pool = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => item(id));

	it('geeft het juiste antwoord op correctIndex en unieke afleiders', () => {
		const target = pool[0];
		const { options, correctIndex } = buildChoices(target, pool, 'forward', 4, mulberry32(5));
		expect(options).toHaveLength(4);
		expect(options[correctIndex]).toBe('t-a');
		expect(new Set(options).size).toBe(4);
	});

	it('gebruikt bij terug de termen als opties', () => {
		const { options, correctIndex } = buildChoices(pool[1], pool, 'backward', undefined, mulberry32(5));
		expect(options).toHaveLength(4);
		expect(options[correctIndex]).toBe('w-b');
		expect(options.every((o) => o.startsWith('w-'))).toBe(true);
	});

	it('sluit gelijke antwoorden en alternatieven van het doel uit', () => {
		const target = item('x', 'rapide', { alternatives: ['vite'] });
		const poolWithDupes = [
			target,
			item('p1', 'Rapide'),
			item('p2', 'vite'),
			item('p3', 'lent'),
			item('p4', 'lent'),
			item('p5', 'grand')
		];
		for (let seed = 0; seed < 20; seed++) {
			const { options, correctIndex } = buildChoices(target, poolWithDupes, 'forward', 4, mulberry32(seed));
			expect(options[correctIndex]).toBe('rapide');
			expect(options.map((o) => o.toLowerCase()).sort()).toEqual(['grand', 'lent', 'rapide']);
		}
	});

	it('geeft minder opties bij een kleine pool en een lege lijst als er geen afleider is', () => {
		const two = buildChoices(pool[0], pool.slice(0, 2), 'forward', 4, mulberry32(1));
		expect(two.options).toHaveLength(2);
		expect(two.options[two.correctIndex]).toBe('t-a');
		expect(buildChoices(pool[0], [pool[0]], 'forward', 4, mulberry32(1))).toEqual({
			options: [],
			correctIndex: -1
		});
		expect(buildChoices(pool[0], [], 'forward', 4, mulberry32(1)).options).toEqual([]);
	});
});
