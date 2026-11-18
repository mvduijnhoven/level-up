// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LevelUpDB } from '#lib/data/db.ts';
import { createDexieStore } from '#lib/data/dexie-store.ts';
import type { Store } from '#lib/data/store.ts';
import {
	DAY_MS,
	dateKey,
	levelFromXp,
	mulberry32,
	type Direction,
	type GameMode,
	type Item,
	type Progress,
	type SessionDirection
} from '#lib/domain/index.ts';
import { loadSession, type PracticeSession } from './session.svelte.ts';

const T0 = Date.UTC(2026, 2, 10, 12, 0, 0);
const LIST = 'l1';

let counter = 0;
let db: LevelUpDB;
let store: Store;
const clock = { t: T0 };
const now = () => clock.t;

beforeEach(async () => {
	clock.t = T0;
	db = new LevelUpDB(`level-up-session-${++counter}`);
	store = createDexieStore(db);
	await store.lists.put({
		id: LIST, title: 'Testlijst', source: 'Nederlands', target: 'Frans', origin: 'own', version: 1, createdAt: 1, updatedAt: 1
	});
});

afterEach(async () => {
	await db.delete();
});

const WORDS: [string, string][] = [
	['huis', 'la maison'], ['hond', 'le chien'], ['kat', 'le chat'], ['boek', 'le livre'],
	['school', "l'école"], ['water', "l'eau"], ['brood', 'le pain'], ['melk', 'le lait'],
	['appel', 'la pomme'], ['tafel', 'la table'], ['stoel', 'la chaise'], ['raam', 'la fenêtre']
];

async function seed(count: number, box = 0, dueOffsetDays = -1, directions: Direction[] = ['forward']) {
	const items: Item[] = WORDS.slice(0, count).map(([term, translation], i) => ({
		id: `i${i}`, listId: LIST, term, translation, alternatives: [], example: `Voorbeeld ${i}.`, updatedAt: 1
	}));
	await store.items.bulkPut(items);
	known = items;
	if (box > 0) {
		const progress: Progress[] = items.flatMap((item) =>
			directions.map((direction) => ({
				itemId: item.id, listId: LIST, direction, box, dueAt: T0 + dueOffsetDays * DAY_MS,
				correct: 1, almost: 0, wrong: 0, lastPracticedAt: T0 - 5 * DAY_MS, updatedAt: T0 - 5 * DAY_MS
			}))
		);
		await store.progress.bulkPut(progress);
	}
	return items;
}

function open(mode: GameMode = 'learn', direction: SessionDirection = 'forward', extra: Partial<{ extra: boolean; autoStart: boolean }> = {}, seedNo = 7) {
	return loadSession({ store, listId: LIST, direction, mode, now, rng: mulberry32(seedNo), ...extra });
}

let known: Item[] = [];
const answerOf = (prompt: string, direction: Direction) => {
	const item = known.find((i) => (direction === 'forward' ? i.term : i.translation) === prompt)!;
	return direction === 'forward' ? item.translation : item.term;
};

/** Beantwoordt de huidige vraag goed of fout en geeft vorm en item terug. */
function answer(session: PracticeSession, right: boolean) {
	const q = session.question!;
	const correct = answerOf(q.prompt, q.direction);
	if (q.form === 'choice') {
		const correctIndex = q.options.indexOf(correct);
		session.selectChoice(right ? correctIndex : (correctIndex + 1) % q.options.length);
	} else {
		session.submitAnswer(right ? correct : 'zzzzzzzz');
	}
	return { form: q.form, itemId: q.itemId, prompt: q.prompt };
}

/** Speelt een hele leersessie; `wrongFirst` = itemId dat bij de eerste keer fout wordt beantwoord. */
function playAll(session: PracticeSession, wrongFirst?: string) {
	const log: { form: string; itemId: string }[] = [];
	let failed = false;
	let guard = 0;
	while (session.status === 'asking' && guard++ < 200) {
		const q = session.question!;
		const right = !(q.itemId === wrongFirst && !failed);
		if (!right) failed = true;
		log.push(answer(session, right));
		session.next();
	}
	return log;
}

describe('vraagvolgorde', () => {
	it('stelt een nieuw item eerst als meerkeuze en later als typvraag', async () => {
		await seed(5);
		const session = await open();
		expect(session.status).toBe('asking');
		const log = playAll(session);
		for (let i = 0; i < 5; i++) {
			const forms = log.filter((l) => l.itemId === `i${i}`).map((l) => l.form);
			expect(forms).toEqual(['choice', 'typing']);
		}
		await session.flush();
		expect(session.status).toBe('finished');
	});

	it('stelt een bekend item direct als typvraag', async () => {
		await seed(6, 2);
		const session = await open();
		const log = playAll(session);
		expect(log).toHaveLength(6);
		expect(log.every((l) => l.form === 'typing')).toBe(true);
	});

	it('valt terug op typen als er te weinig afleiders zijn', async () => {
		await seed(1);
		const session = await open();
		const log = playAll(session);
		expect(log.map((l) => l.form)).toEqual(['typing']);
	});

	it('toont de voorbeeldzin pas in de feedback', async () => {
		await seed(6, 2);
		const session = await open();
		expect(Object.keys(session.question!)).not.toContain('example');
		answer(session, true);
		expect(session.feedback?.example).toMatch(/^Voorbeeld/);
	});
});

describe('foutherhaling en bijna goed', () => {
	it('zet een fout item minstens twee keer terug, met typen, nooit direct achter elkaar', async () => {
		await seed(10, 2);
		for (const seedNo of [1, 2, 3, 4, 5]) {
			await store.clearAll();
			await store.lists.put({
				id: LIST, title: 'Testlijst', source: 'Nederlands', target: 'Frans', origin: 'own', version: 1, createdAt: 1, updatedAt: 1
			});
			await seed(10, 2);
			const session = await open('learn', 'forward', {}, seedNo);
			const first = session.question!.itemId;
			const log = playAll(session, first);
			const positions = log.map((l, i) => (l.itemId === first ? i : -1)).filter((i) => i >= 0);
			expect(positions.length).toBeGreaterThanOrEqual(3);
			expect(log.slice(positions[1]).some((l) => l.itemId === first && l.form === 'typing')).toBe(true);
			for (let i = 1; i < positions.length; i++) {
				expect(positions[i] - positions[i - 1]).toBeGreaterThanOrEqual(2);
			}
			expect(positions[1] - positions[0]).toBeLessThanOrEqual(5);
		}
	});

	it('herhaalt een fout meerkeuzeantwoord als meerkeuze en daarna als typvraag', async () => {
		await seed(8);
		const session = await open();
		const first = session.question!.itemId;
		const forms = playAll(session, first).filter((l) => l.itemId === first).map((l) => l.form);
		expect(forms).toEqual(['choice', 'choice', 'typing']);
	});

	it('geeft bakje 1 en plant morgen opnieuw bij een fout, ook als later alles goed gaat', async () => {
		await seed(6, 3);
		const session = await open();
		const first = session.question!.itemId;
		playAll(session, first);
		await session.flush();
		const p = await store.progress.get(first, 'forward');
		expect(p?.box).toBe(1);
		expect(p?.wrong).toBe(1);
		expect(p!.dueAt).toBe(T0 + DAY_MS);
	});

	it("telt 'bijna goed' als herhaling zonder fout", async () => {
		const items = await seed(6, 2);
		known = items.map((item, i) => ({ ...item, translation: `ordinateur${i}`, term: `woord${i}` }));
		await store.items.bulkPut(known);
		const session = await open();
		const q = session.question!;
		const first = q.itemId;
		const correct = `ordinateur${first.slice(1)}`;
		session.submitAnswer(correct.slice(0, -2) + correct.slice(-1) + correct.slice(-2, -1));
		expect(session.feedback?.result).toBe('almost');
		expect(session.feedback?.message).toMatch(/Bijna goed/);
		expect(session.feedback?.segments?.length).toBeGreaterThan(0);
		expect(session.feedback?.xp).toBeGreaterThan(0);
		const log = [{ form: 'typing', itemId: first }];
		session.next();
		log.push(...playAll(session));
		expect(log.filter((l) => l.itemId === first)).toHaveLength(2);
		await session.flush();
		expect(session.counts.wrong).toBe(0);
		expect(session.counts.almost).toBe(1);
		const p = await store.progress.get(first, 'forward');
		expect(p?.box).toBe(2);
		expect(p?.wrong).toBe(0);
		expect(p?.almost).toBe(1);
	});
});

describe('ik had het goed', () => {
	it('corrigeert voortgang, review en XP en verwijdert de herhaling', async () => {
		await seed(6, 2);
		const session = await open();
		const q = session.question!;
		session.submitAnswer('zzzzzzzz');
		expect(session.feedback?.result).toBe('wrong');
		expect(session.canOverride).toBe(true);
		session.overrideAsCorrect();
		expect(session.feedback?.result).toBe('correct');
		expect(session.feedback?.overridden).toBe(true);
		expect(session.canOverride).toBe(false);
		expect(session.counts).toEqual({ correct: 1, almost: 0, wrong: 0 });
		expect(session.combo).toBe(1);
		const xpAfter = session.xpEarned;
		expect(xpAfter).toBeGreaterThan(0);
		session.next();
		const log = playAll(session);
		expect(log.filter((l) => l.itemId === q.itemId)).toHaveLength(0);
		await session.flush();
		const p = await store.progress.get(q.itemId, 'forward');
		expect(p?.box).toBe(3);
		expect(p?.wrong).toBe(0);
		const reviews = await store.reviews.byList(LIST);
		expect(reviews.filter((r) => r.itemId === q.itemId).map((r) => r.result)).toEqual(['correct']);
		expect((await store.profile.get()).xp).toBe(session.xpEarned);
	});

	it('is niet mogelijk bij meerkeuze of bij een goed antwoord', async () => {
		await seed(6);
		const session = await open();
		answer(session, false);
		expect(session.canOverride).toBe(false);
		session.overrideAsCorrect();
		expect(session.feedback?.result).toBe('wrong');
	});
});

describe('voortgang opslaan', () => {
	it('slaat per antwoord op en houdt richtingen gescheiden', async () => {
		await seed(6, 1, -1, ['forward', 'backward']);
		const session = await open('learn', 'backward');
		const q = session.question!;
		expect(q.direction).toBe('backward');
		expect(q.prompt).toBe(WORDS.find(([, tr]) => tr === q.prompt)![1]);
		expect(q.fromLang).toBe('Frans');
		expect(q.toLang).toBe('Nederlands');
		answer(session, true);
		await session.flush();
		expect((await store.progress.get(q.itemId, 'backward'))?.box).toBe(2);
		expect((await store.progress.get(q.itemId, 'forward'))?.box).toBe(1);
		session.quit();
		await session.flush();
		expect(session.status).toBe('quit');
		expect((await store.reviews.byList(LIST))).toHaveLength(1);
		expect((await store.profile.get()).xp).toBeGreaterThan(0);
		expect((await store.activity.all())[0].date).toBe(dateKey(T0, -new Date(T0).getTimezoneOffset()));
	});

	it('beide richtingen: elk item komt in beide richtingen voor', async () => {
		await seed(3, 2, -1, ['forward', 'backward']);
		const session = await open('learn', 'both');
		const seen = new Set<string>();
		let guard = 0;
		while (session.status === 'asking' && guard++ < 50) {
			seen.add(`${session.question!.itemId}|${session.question!.direction}`);
			answer(session, true);
			session.next();
		}
		expect(seen.size).toBe(6);
	});
});

describe('toestanden zonder oefening', () => {
	it('geeft not-found, lege lijst en alles-op-schema', async () => {
		const missing = await loadSession({ store, listId: 'nope', direction: 'forward', mode: 'learn', now, rng: mulberry32(1) });
		expect(missing.status).toBe('not-found');

		const empty = await open();
		expect(empty.status).toBe('nothing-due');
		expect(empty.emptyReason).toBe('empty-list');

		await seed(6, 3, 5);
		const upToDate = await open();
		expect(upToDate.status).toBe('nothing-due');
		expect(upToDate.emptyReason).toBe('up-to-date');
		const extra = await open('learn', 'forward', { extra: true });
		expect(extra.status).toBe('asking');
	});

	it('SM-05: speedrun met te weinig geoefende items verwijst naar leren', async () => {
		await seed(6);
		await store.progress.bulkPut(
			WORDS.slice(0, 4).map(([], i) => ({
				itemId: `i${i}`, listId: LIST, direction: 'forward' as const, box: 1, dueAt: T0 + DAY_MS,
				correct: 1, almost: 0, wrong: 0, lastPracticedAt: T0, updatedAt: T0
			}))
		);
		const session = await open('speedrun');
		expect(session.status).toBe('needs-learning');
		expect(session.poolSize).toBe(4);

		await store.progress.put({
			itemId: 'i4', listId: LIST, direction: 'backward', box: 1, dueAt: T0, correct: 1, almost: 0, wrong: 0, lastPracticedAt: T0, updatedAt: T0
		});
		expect((await open('speedrun', 'forward')).status).toBe('needs-learning');
		expect((await open('speedrun', 'both')).status).toBe('asking');
	});
});

describe('speedrun', () => {
	async function speedrun() {
		await seed(8, 2);
		const session = await open('speedrun', 'forward', { autoStart: false });
		expect(session.status).toBe('ready');
		session.start();
		return session;
	}

	it('geeft combo, bonustijd na 5 goed en laat de tijd alleen tijdens vragen lopen', async () => {
		const session = await speedrun();
		expect(session.timeLeftMs).toBe(60_000);
		let prev = '';
		for (let i = 0; i < 5; i++) {
			clock.t += 1000;
			session.tick();
			expect(session.question!.prompt).not.toBe(prev);
			prev = session.question!.prompt;
			expect(session.question!.form).toBe('typing');
			answer(session, true);
			clock.t += 10_000; // tijd tijdens feedback telt niet
			session.next();
		}
		expect(session.combo).toBe(5);
		expect(session.timeLeftMs).toBe(60_000 - 5 * 1000 + 5000);
		expect(session.score).toBe(5 * 10 + 2);
		clock.t += 3000;
		session.tick();
		expect(session.timeLeftMs).toBe(60_000 - 3000);
		answer(session, false);
		expect(session.combo).toBe(0);
		expect(session.tally.maxCombo).toBe(5);
		const before = session.timeLeftMs;
		clock.t += 20_000;
		session.tick();
		expect(session.timeLeftMs).toBe(before);
	});

	it('eindigt als de tijd op is, bewaart score en highscore en meldt een record', async () => {
		const session = await speedrun();
		for (let i = 0; i < 3; i++) {
			clock.t += 500;
			answer(session, true);
			session.next();
		}
		clock.t += 70_000;
		session.tick();
		expect(session.status).toBe('finishing');
		await session.flush();
		expect(session.status).toBe('finished');
		const s = session.summary!;
		expect(s.mode).toBe('speedrun');
		expect(s.score).toBe(30);
		expect(s.correct).toBe(3);
		expect(s.maxCombo).toBe(3);
		expect(s.newRecord).toBe(true);
		expect(s.previousBest).toBeNull();
		expect((await store.highscores.get(LIST, 'forward', 'speedrun'))?.score).toBe(30);
		expect(await store.sessions.recent(5)).toHaveLength(1);

		// Een lagere score is geen record
		const again = await open('speedrun', 'forward', { autoStart: true }, 9);
		clock.t += 100;
		answer(again, true);
		again.next();
		clock.t += 70_000;
		again.tick();
		await again.flush();
		expect(again.summary?.newRecord).toBe(false);
		expect(again.summary?.previousBest).toBe(30);
		expect((await store.highscores.get(LIST, 'forward', 'speedrun'))?.score).toBe(30);
	});

	it('negeert antwoorden nadat de tijd op is', async () => {
		const session = await speedrun();
		clock.t += 61_000;
		session.submitAnswer('iets');
		expect(session.answered).toBe(0);
		await session.flush();
		expect(session.status).toBe('finished');
		expect(session.summary?.answered).toBe(0);
		expect(await store.sessions.recent(5)).toHaveLength(0);
	});
});

describe('einde van de sessie', () => {
	it('maakt een samenvatting met XP, niveau, verbeterde items en bewaart het sessierecord', async () => {
		await seed(5);
		await store.profile.update({ xp: 45 });
		const session = await open();
		const log = playAll(session);
		expect(log).toHaveLength(10);
		await session.flush();
		expect(session.status).toBe('finished');
		const s = session.summary!;
		expect(s.correct).toBe(10);
		expect(s.wrong).toBe(0);
		expect(s.answered).toBe(10);
		expect(s.maxCombo).toBe(10);
		expect(s.score).toBe(100);
		// 5 × meerkeuze goed (6 XP) + 5 × typen (herhaling, maximaal 2 XP)
		expect(s.xpEarned).toBe(5 * 6 + 5 * 2);
		expect(s.levelBefore.level).toBe(1);
		expect(s.levelAfter).toEqual(levelFromXp(45 + s.xpEarned));
		expect(s.levelUp).toBe(true);
		expect(s.improved).toHaveLength(5);
		expect(s.improved.every((i) => i.from === 'new' && i.to === 'practiced')).toBe(true);
		expect(s.newlyMastered).toHaveLength(0);
		expect((await store.profile.get()).xp).toBe(45 + s.xpEarned);
		const [record] = await store.sessions.recent(1);
		expect(record).toMatchObject({ listId: LIST, mode: 'learn', direction: 'forward', correct: 10, xpEarned: s.xpEarned });
		expect(await store.reviews.byList(LIST)).toHaveLength(10);
		const days = await store.activity.all();
		expect(days.reduce((sum, d) => sum + d.xp, 0)).toBe(s.xpEarned);
		expect(session.saveError).toBeNull();
	});

	it('meldt nieuw beheerste items', async () => {
		await seed(6, 4);
		const session = await open();
		playAll(session);
		await session.flush();
		expect(session.summary?.newlyMastered).toHaveLength(6);
	});
});
