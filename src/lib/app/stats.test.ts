// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LevelUpDB } from '#lib/data/db.ts';
import { createDexieStore } from '#lib/data/dexie-store.ts';
import type { Store } from '#lib/data/store.ts';
import { DAY_MS, type Direction, type Item, type Progress, type WordList } from '#lib/domain/index.ts';
import { getListOverviews, getProfileSummary } from './stats.ts';

let counter = 0;
let db: LevelUpDB;
let store: Store;

// Woensdag 18 november 2026, 12:00 lokale tijd
const NOW = new Date(2026, 10, 18, 12).getTime();

beforeEach(() => {
	db = new LevelUpDB(`level-up-stats-${++counter}`);
	store = createDexieStore(db);
});

afterEach(async () => {
	await db.delete();
});

const list = (id: string, title = id): WordList => ({
	id, title, source: 'Nederlands', target: 'Frans', origin: 'own', version: 1, createdAt: 1, updatedAt: 1
});
const item = (id: string, listId: string): Item => ({
	id, listId, term: id, translation: id, alternatives: [], updatedAt: 1
});
const prog = (
	itemId: string, listId: string, direction: Direction, box: number, dueAt: number | null, last: number | null
): Progress => ({
	itemId, listId, direction, box, dueAt, correct: 1, almost: 0, wrong: 0, lastPracticedAt: last, updatedAt: 1
});

describe('getProfileSummary', () => {
	it('geeft niveau en weekvoortgang vanaf maandag', async () => {
		await store.profile.update({ xp: 120, weeklyGoalDays: 3 });
		await store.activity.record('2026-11-15', 10); // zondag vorige week: telt niet
		await store.activity.record('2026-11-16', 10);
		await store.activity.record('2026-11-18', 40);

		const { profile, level, week } = await getProfileSummary(store, NOW);
		expect(profile.xp).toBe(120);
		expect(level.level).toBeGreaterThan(1);
		expect(week.days[0].date).toBe('2026-11-16');
		expect(week.activeCount).toBe(2);
		expect(week.goalDays).toBe(3);
		expect(week.reached).toBe(false);
		expect(week.days.find((d) => d.isToday)?.date).toBe('2026-11-18');
	});

	it('werkt met een nieuw profiel zonder activiteit', async () => {
		const { level, week } = await getProfileSummary(store, NOW);
		expect(level.level).toBe(1);
		expect(week.activeCount).toBe(0);
		expect(week.goalDays).toBe(4);
	});
});

describe('getListOverviews', () => {
	it('geeft een lege lijst zonder lijsten', async () => {
		expect(await getListOverviews(store, NOW)).toEqual([]);
	});

	it('telt items zonder voortgang als nieuw', async () => {
		await store.lists.put(list('a'));
		await store.items.bulkPut([item('a1', 'a'), item('a2', 'a')]);
		const [o] = await getListOverviews(store, NOW);
		expect(o.itemCount).toBe(2);
		expect(o.perDirection.forward).toEqual({
			counts: { new: 2, practiced: 0, known: 0, mastered: 0 }, due: 0, new: 2
		});
		expect(o.totalNew).toBe(4);
		expect(o.totalDue).toBe(0);
		expect(o.lastPracticedAt).toBeNull();
	});

	it('berekent beheersing, achterstallig en nieuw per richting', async () => {
		await store.lists.put(list('a'));
		await store.items.bulkPut([item('a1', 'a'), item('a2', 'a'), item('a3', 'a')]);
		await store.progress.bulkPut([
			prog('a1', 'a', 'forward', 1, NOW - DAY_MS, NOW - 2 * DAY_MS), // achterstallig
			prog('a2', 'a', 'forward', 5, NOW + DAY_MS, NOW - DAY_MS), // nog niet aan de beurt
			prog('a1', 'a', 'backward', 3, NOW + DAY_MS, NOW - 3 * DAY_MS)
		]);
		const [o] = await getListOverviews(store, NOW);
		expect(o.perDirection.forward).toEqual({
			counts: { new: 1, practiced: 1, known: 0, mastered: 1 }, due: 1, new: 1
		});
		expect(o.perDirection.backward).toEqual({
			counts: { new: 2, practiced: 0, known: 1, mastered: 0 }, due: 0, new: 2
		});
		expect(o.totalDue).toBe(1);
		expect(o.totalNew).toBe(3);
		expect(o.lastPracticedAt).toBe(NOW - DAY_MS);
	});

	it('negeert voortgang van items die niet (meer) in de lijst staan', async () => {
		await store.lists.put(list('a'));
		await store.items.put(item('a1', 'a'));
		await store.progress.put(prog('weg', 'a', 'forward', 1, NOW - 1, NOW - 1));
		const [o] = await getListOverviews(store, NOW);
		expect(o.totalDue).toBe(0);
		expect(o.lastPracticedAt).toBeNull();
	});

	it('sorteert op meeste achterstallig, dan recentst geoefend, dan titel', async () => {
		for (const [id, title] of [['b', 'Beta'], ['a', 'Alfa'], ['c', 'Gamma'], ['d', 'Delta']]) {
			await store.lists.put(list(id, title));
			await store.items.bulkPut([item(`${id}1`, id), item(`${id}2`, id)]);
		}
		await store.progress.bulkPut([
			prog('b1', 'b', 'forward', 1, NOW - 1, NOW - 5 * DAY_MS),
			prog('b2', 'b', 'forward', 1, NOW - 1, NOW - 5 * DAY_MS),
			prog('c1', 'c', 'forward', 1, NOW - 1, NOW - 9 * DAY_MS),
			prog('d1', 'd', 'forward', 5, NOW + DAY_MS, NOW - DAY_MS)
		]);
		const order = (await getListOverviews(store, NOW)).map((o) => o.list.id);
		expect(order).toEqual(['b', 'c', 'd', 'a']);
	});
});
