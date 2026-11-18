// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, type Item, type Progress, type WordList } from '#lib/domain/types.ts';
import { LevelUpDB } from './db.ts';
import { createDexieStore } from './dexie-store.ts';
import type { Store } from './store.ts';

let counter = 0;
let db: LevelUpDB;
let store: Store;

beforeEach(() => {
	db = new LevelUpDB(`level-up-test-${++counter}`);
	store = createDexieStore(db);
});

afterEach(async () => {
	await db.delete();
});

const list = (id: string): WordList => ({
	id, title: `Lijst ${id}`, source: 'Nederlands', target: 'Frans', origin: 'own', version: 1, createdAt: 1, updatedAt: 1
});
const item = (id: string, listId: string): Item => ({
	id, listId, term: `term ${id}`, translation: `vertaling ${id}`, alternatives: [], updatedAt: 1
});
const progress = (itemId: string, listId: string, direction: 'forward' | 'backward', box = 1): Progress => ({
	itemId, listId, direction, box, dueAt: 100, correct: 1, almost: 0, wrong: 0, lastPracticedAt: 50, updatedAt: 50
});

async function seed() {
	await store.lists.put(list('a'));
	await store.lists.put(list('b'));
	await store.items.bulkPut([item('a1', 'a'), item('a2', 'a'), item('b1', 'b')]);
	await store.progress.bulkPut([
		progress('a1', 'a', 'forward'), progress('a1', 'a', 'backward', 3),
		progress('a2', 'a', 'forward'), progress('b1', 'b', 'forward')
	]);
	await store.reviews.add({
		id: 'r1', sessionId: 's1', itemId: 'a1', listId: 'a', direction: 'forward',
		result: 'correct', form: 'typing', answerTimeMs: 1000, at: 10
	});
	await store.reviews.add({
		id: 'r2', sessionId: 's2', itemId: 'b1', listId: 'b', direction: 'forward',
		result: 'wrong', form: 'choice', answerTimeMs: 2000, at: 20
	});
	await store.sessions.add({
		id: 's1', listId: 'a', direction: 'both', mode: 'learn', score: 10, xpEarned: 5,
		correct: 1, almost: 0, wrong: 0, startedAt: 1, endedAt: 100
	});
	await store.sessions.add({
		id: 's2', listId: 'b', direction: 'forward', mode: 'speedrun', score: 20, xpEarned: 8,
		correct: 2, almost: 0, wrong: 0, startedAt: 1, endedAt: 200
	});
	await store.highscores.submit('a', 'forward', 'learn', 10, 5);
	await store.highscores.submit('a', 'both', 'speedrun', 30, 6);
	await store.highscores.submit('b', 'forward', 'learn', 40, 7);
	await store.activity.record('2026-01-01', 5);
}

describe('lijsten en items', () => {
	it('slaat lijsten en items op en leest ze terug', async () => {
		await seed();
		expect((await store.lists.all()).map((l) => l.id).sort()).toEqual(['a', 'b']);
		expect((await store.lists.get('a'))?.title).toBe('Lijst a');
		expect(await store.lists.get('x')).toBeUndefined();
		expect(await store.items.countByList('a')).toBe(2);
		expect((await store.items.byList('b')).map((i) => i.id)).toEqual(['b1']);
		await store.items.put({ ...item('a1', 'a'), term: 'nieuw' });
		expect((await store.items.byList('a')).find((i) => i.id === 'a1')?.term).toBe('nieuw');
	});

	it('verwijdert een lijst met alles wat erbij hoort, maar niets anders', async () => {
		await seed();
		await store.lists.delete('a');
		expect(await store.lists.get('a')).toBeUndefined();
		expect(await store.items.countByList('a')).toBe(0);
		expect(await store.progress.byList('a')).toEqual([]);
		expect(await store.reviews.byList('a')).toEqual([]);
		expect((await store.sessions.recent(10)).map((s) => s.id)).toEqual(['s2']);
		expect(await store.highscores.get('a', 'forward', 'learn')).toBeUndefined();
		expect(await store.highscores.get('a', 'both', 'speedrun')).toBeUndefined();
		expect(await store.highscores.get('b', 'forward', 'learn')).toBeDefined();
		expect(await store.items.countByList('b')).toBe(1);
		expect(await store.progress.byList('b')).toHaveLength(1);
		expect(await store.reviews.byList('b')).toHaveLength(1);
	});

	it('verwijdert een item met zijn voortgang in beide richtingen', async () => {
		await seed();
		await store.items.delete('a1');
		expect(await store.items.countByList('a')).toBe(1);
		expect(await store.progress.get('a1', 'forward')).toBeUndefined();
		expect(await store.progress.get('a1', 'backward')).toBeUndefined();
		expect(await store.progress.get('a2', 'forward')).toBeDefined();
	});
});

describe('voortgang', () => {
	it('houdt richtingen gescheiden', async () => {
		await seed();
		expect((await store.progress.get('a1', 'forward'))?.box).toBe(1);
		expect((await store.progress.get('a1', 'backward'))?.box).toBe(3);
		expect(await store.progress.byList('a')).toHaveLength(3);
		expect(await store.progress.byList('a', 'forward')).toHaveLength(2);
		expect((await store.progress.byList('a', 'backward')).map((p) => p.itemId)).toEqual(['a1']);
		await store.progress.put({ ...progress('a1', 'a', 'forward'), box: 4 });
		expect((await store.progress.get('a1', 'forward'))?.box).toBe(4);
		expect((await store.progress.get('a1', 'backward'))?.box).toBe(3);
	});
});

describe('sessies, highscores en activiteit', () => {
	it('geeft de meest recente sessies eerst', async () => {
		await seed();
		expect((await store.sessions.recent(10)).map((s) => s.id)).toEqual(['s2', 's1']);
		expect(await store.sessions.recent(1)).toHaveLength(1);
	});

	it('bewaart een highscore alleen als die hoger is', async () => {
		expect(await store.highscores.submit('a', 'forward', 'learn', 10, 1)).toBe(true);
		expect(await store.highscores.submit('a', 'forward', 'learn', 10, 2)).toBe(false);
		expect(await store.highscores.submit('a', 'forward', 'learn', 5, 3)).toBe(false);
		expect((await store.highscores.get('a', 'forward', 'learn'))?.achievedAt).toBe(1);
		expect(await store.highscores.submit('a', 'forward', 'learn', 11, 4)).toBe(true);
		expect(await store.highscores.get('a', 'forward', 'learn')).toMatchObject({ score: 11, achievedAt: 4 });
		expect(await store.highscores.get('a', 'backward', 'learn')).toBeUndefined();
		expect(await store.highscores.get('a', 'forward', 'speedrun')).toBeUndefined();
	});

	it('telt XP per dag op', async () => {
		await store.activity.record('2026-01-01', 5);
		await store.activity.record('2026-01-01', 7);
		await store.activity.record('2026-01-03', 1);
		expect(await store.activity.all()).toEqual([
			{ date: '2026-01-01', xp: 12 }, { date: '2026-01-03', xp: 1 }
		]);
		expect(await store.activity.since('2026-01-02')).toEqual([{ date: '2026-01-03', xp: 1 }]);
	});
});

describe('profiel', () => {
	it('maakt het profiel aan met standaardwaarden', async () => {
		const profile = await store.profile.get();
		expect(profile).toMatchObject(DEFAULT_PROFILE);
		expect(profile.createdAt).toBeGreaterThan(0);
		expect(await store.profile.get()).toEqual(profile);
	});

	it('vult ontbrekende velden van een ouder profiel aan', async () => {
		await db.profile.put({ id: 'profile', xp: 42, createdAt: 7 } as never);
		const profile = await store.profile.get();
		expect(profile).toMatchObject({ ...DEFAULT_PROFILE, xp: 42, createdAt: 7 });
		expect((await db.profile.get('profile'))?.weeklyGoalDays).toBe(DEFAULT_PROFILE.weeklyGoalDays);
	});

	it('past het profiel aan zonder te valideren', async () => {
		const updated = await store.profile.update({ xp: 10, weeklyGoalDays: 99 });
		expect(updated).toMatchObject({ xp: 10, weeklyGoalDays: 99 });
		expect(await store.profile.get()).toEqual(updated);
	});
});

describe('export en import', () => {
	it('geeft na export en import dezelfde gegevens terug', async () => {
		await seed();
		await store.profile.update({ xp: 77 });
		const backup = await store.exportAll();
		expect(backup).toMatchObject({ app: 'level-up', format: 1 });

		const otherDb = new LevelUpDB(`level-up-test-roundtrip-${counter}`);
		const other = createDexieStore(otherDb);
		await other.importAll(JSON.parse(JSON.stringify(backup)));
		const again = await other.exportAll();
		const strip = ({ exportedAt: _, ...rest }: typeof backup) => rest;
		const sorted = (b: typeof backup) => ({
			...strip(b),
			progress: [...b.progress].sort((x, y) => (x.itemId + x.direction).localeCompare(y.itemId + y.direction))
		});
		expect(sorted(again)).toEqual(sorted(backup));
		await otherDb.delete();
	});

	it('vervangt bestaande gegevens bij import', async () => {
		await seed();
		const empty = await createDexieStore(new LevelUpDB(`level-up-test-empty-${counter}`)).exportAll();
		await store.importAll(empty);
		expect(await store.lists.all()).toEqual([]);
		expect(await store.progress.byList('a')).toEqual([]);
	});

	it('negeert onbekende extra velden', async () => {
		const backup = await store.exportAll();
		await store.importAll({
			...backup,
			extra: 1,
			lists: [{ ...list('x'), bogus: true }]
		});
		expect(await store.lists.get('x')).toEqual(list('x'));
	});

	describe('ongeldige bestanden', () => {
		const bad: Array<[string, (b: Record<string, unknown>) => unknown]> = [
			['geen object', () => 'tekst'],
			['null', () => null],
			['array', () => []],
			['verkeerde app', (b) => ({ ...b, app: 'andere-app' })],
			['verkeerd formaat', (b) => ({ ...b, format: 2 })],
			['ontbrekende array', (b) => ({ ...b, items: undefined })],
			['array is geen array', (b) => ({ ...b, lists: {} })],
			['lijst zonder titel', (b) => ({ ...b, lists: [{ ...list('x'), title: undefined }] })],
			['lijst met verkeerde origin', (b) => ({ ...b, lists: [{ ...list('x'), origin: 'zelf' }] })],
			['item met verkeerd type', (b) => ({ ...b, items: [{ ...item('i', 'a'), term: 5 }] })],
			['voortgang met ongeldige richting', (b) => ({ ...b, progress: [{ ...progress('a1', 'a', 'forward'), direction: 'sideways' }] })],
			['voortgang met ongeldig bakje', (b) => ({ ...b, progress: [{ ...progress('a1', 'a', 'forward'), box: 9 }] })],
			['sessie met ongeldige modus', (b) => ({ ...b, sessions: [{ id: 's', listId: 'a', direction: 'both', mode: 'x' }] })],
			['highscore met ongeldige modus', (b) => ({ ...b, highscores: [{ listId: 'a', direction: 'forward', mode: 'x', score: 1, achievedAt: 1 }] })],
			['review met ongeldig resultaat', (b) => ({ ...b, reviews: [{ id: 'r', sessionId: 's', itemId: 'i', listId: 'a', direction: 'forward', result: 'x', form: 'typing', answerTimeMs: 1, at: 1 }] })],
			['element is geen object', (b) => ({ ...b, items: [null] })],
			['activiteit met ongeldige datum', (b) => ({ ...b, activity: [{ date: 'gisteren', xp: 1 }] })],
			['profiel met verkeerd type', (b) => ({ ...b, profile: { ...DEFAULT_PROFILE, createdAt: 1, soundOn: 'ja' } })],
			['profiel ontbreekt', (b) => ({ ...b, profile: undefined })]
		];

		it.each(bad)('weigert: %s, en laat bestaande gegevens ongemoeid', async (_name, mutate) => {
			await seed();
			const before = await store.exportAll();
			const base = JSON.parse(JSON.stringify(before)) as Record<string, unknown>;
			const broken = mutate(base);
			await expect(store.importAll(broken)).rejects.toThrow(/back-upbestand/);
			const after = await store.exportAll();
			expect({ ...after, exportedAt: 0 }).toEqual({ ...before, exportedAt: 0 });
		});

		it('geeft een Nederlandse foutmelding', async () => {
			await expect(store.importAll({ app: 'level-up', format: 1 })).rejects.toThrow(/Level Up/);
		});
	});

	it('wist alle gegevens met clearAll', async () => {
		await seed();
		await store.clearAll();
		const backup = await store.exportAll();
		expect(backup.lists).toEqual([]);
		expect(backup.profile).toBeNull();
		expect(backup.activity).toEqual([]);
	});
});


