import {
	DEFAULT_PROFILE, MAX_BOX, type ActivityDay, type BackupFile, type Highscore, type Item,
	type Profile, type Progress, type ReviewRecord, type SessionRecord, type WordList
} from '#lib/domain/types.ts';

const DIRECTIONS = ['forward', 'backward'];
const SESSION_DIRECTIONS = ['forward', 'backward', 'both'];
const MODES = ['learn', 'speedrun'];
const RESULTS = ['correct', 'almost', 'wrong'];
const FORMS = ['choice', 'typing'];
const ORIGINS = ['own', 'library'];

type Rec = Record<string, unknown>;

function fail(message: string): never {
	throw new Error(`Dit is geen geldig back-upbestand van Level Up: ${message}`);
}

function isRecord(value: unknown): value is Rec {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(r: Rec, key: string, where: string, allowEmpty = true): string {
	const v = r[key];
	if (typeof v !== 'string' || (!allowEmpty && v === '')) {
		fail(`${where} mist het tekstveld "${key}" of dat veld is leeg.`);
	}
	return v;
}

function num(r: Rec, key: string, where: string): number {
	const v = r[key];
	if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${where} mist het getal "${key}".`);
	return v;
}

function nullableNum(r: Rec, key: string, where: string): number | null {
	if (r[key] === null) return null;
	return num(r, key, where);
}

function bool(r: Rec, key: string, where: string): boolean {
	const v = r[key];
	if (typeof v !== 'boolean') fail(`${where} mist het veld "${key}" (ja/nee).`);
	return v;
}

function oneOf<T extends string>(r: Rec, key: string, allowed: string[], where: string): T {
	const v = r[key];
	if (typeof v !== 'string' || !allowed.includes(v)) {
		fail(`${where} heeft een ongeldige waarde voor "${key}".`);
	}
	return v as T;
}

function list<T>(root: Rec, key: string, label: string, parse: (r: Rec, where: string) => T): T[] {
	const arr = root[key];
	if (!Array.isArray(arr)) fail(`de lijst "${key}" ontbreekt.`);
	return arr.map((el, i) => {
		const where = `${label} ${i + 1}`;
		if (!isRecord(el)) fail(`${where} is geen geldig onderdeel.`);
		return parse(el, where);
	});
}

function parseProfile(value: unknown): Profile | null {
	if (value === null) return null;
	if (!isRecord(value)) fail('het profiel is geen geldig onderdeel.');
	const where = 'het profiel';
	const has = (k: string) => value[k] !== undefined;
	const intervals = has('intervalsDays') ? value.intervalsDays : DEFAULT_PROFILE.intervalsDays;
	if (!Array.isArray(intervals) || !intervals.every((n) => typeof n === 'number' && Number.isFinite(n))) {
		fail(`${where} heeft ongeldige herhaalintervallen.`);
	}
	return {
		id: 'profile',
		xp: has('xp') ? num(value, 'xp', where) : DEFAULT_PROFILE.xp,
		intervalsDays: [...(intervals as number[])],
		weeklyGoalDays: has('weeklyGoalDays')
			? num(value, 'weeklyGoalDays', where)
			: DEFAULT_PROFILE.weeklyGoalDays,
		soundOn: has('soundOn') ? bool(value, 'soundOn', where) : DEFAULT_PROFILE.soundOn,
		vibrationOn: has('vibrationOn') ? bool(value, 'vibrationOn', where) : DEFAULT_PROFILE.vibrationOn,
		reduceMotion: has('reduceMotion') ? bool(value, 'reduceMotion', where) : DEFAULT_PROFILE.reduceMotion,
		strictAccents: has('strictAccents') ? bool(value, 'strictAccents', where) : DEFAULT_PROFILE.strictAccents,
		lastExportAt: has('lastExportAt') ? nullableNum(value, 'lastExportAt', where) : null,
		createdAt: num(value, 'createdAt', where)
	};
}

/** Controleert een back-upbestand grondig en geeft een opgeschoond exemplaar terug (onbekende velden vervallen). */
export function parseBackup(file: unknown): BackupFile {
	if (!isRecord(file)) fail('de inhoud is geen object.');
	if (file.app !== 'level-up') fail('het bestand is niet door Level Up gemaakt.');
	if (file.format !== 1) fail('dit bestandsformaat wordt niet ondersteund (mogelijk is het van een nieuwere versie).');

	const exportedAt = num(file, 'exportedAt', 'het bestand');

	const lists = list<WordList>(file, 'lists', 'woordenlijst', (r, w) => ({
		id: str(r, 'id', w, false),
		title: str(r, 'title', w),
		source: str(r, 'source', w),
		target: str(r, 'target', w),
		origin: oneOf(r, 'origin', ORIGINS, w),
		version: num(r, 'version', w),
		createdAt: num(r, 'createdAt', w),
		updatedAt: num(r, 'updatedAt', w)
	}));

	const items = list<Item>(file, 'items', 'woord', (r, w) => {
		const alternatives = r.alternatives ?? [];
		if (!Array.isArray(alternatives) || !alternatives.every((a) => typeof a === 'string')) {
			fail(`${w} heeft ongeldige alternatieve antwoorden.`);
		}
		if (r.example !== undefined && typeof r.example !== 'string') fail(`${w} heeft een ongeldige voorbeeldzin.`);
		const item: Item = {
			id: str(r, 'id', w, false),
			listId: str(r, 'listId', w, false),
			term: str(r, 'term', w),
			translation: str(r, 'translation', w),
			alternatives: [...alternatives],
			updatedAt: num(r, 'updatedAt', w)
		};
		if (typeof r.example === 'string') item.example = r.example;
		return item;
	});

	const progress = list<Progress>(file, 'progress', 'voortgangsrecord', (r, w) => {
		const box = num(r, 'box', w);
		if (!Number.isInteger(box) || box < 0 || box > MAX_BOX) fail(`${w} heeft een ongeldig bakje.`);
		return {
			itemId: str(r, 'itemId', w, false),
			listId: str(r, 'listId', w, false),
			direction: oneOf(r, 'direction', DIRECTIONS, w),
			box,
			dueAt: nullableNum(r, 'dueAt', w),
			correct: num(r, 'correct', w),
			almost: num(r, 'almost', w),
			wrong: num(r, 'wrong', w),
			lastPracticedAt: nullableNum(r, 'lastPracticedAt', w),
			updatedAt: num(r, 'updatedAt', w)
		};
	});

	const reviews = list<ReviewRecord>(file, 'reviews', 'antwoord', (r, w) => ({
		id: str(r, 'id', w, false),
		sessionId: str(r, 'sessionId', w),
		itemId: str(r, 'itemId', w, false),
		listId: str(r, 'listId', w, false),
		direction: oneOf(r, 'direction', DIRECTIONS, w),
		result: oneOf(r, 'result', RESULTS, w),
		form: oneOf(r, 'form', FORMS, w),
		answerTimeMs: num(r, 'answerTimeMs', w),
		at: num(r, 'at', w)
	}));

	const sessions = list<SessionRecord>(file, 'sessions', 'sessie', (r, w) => ({
		id: str(r, 'id', w, false),
		listId: str(r, 'listId', w, false),
		direction: oneOf(r, 'direction', SESSION_DIRECTIONS, w),
		mode: oneOf(r, 'mode', MODES, w),
		score: num(r, 'score', w),
		xpEarned: num(r, 'xpEarned', w),
		correct: num(r, 'correct', w),
		almost: num(r, 'almost', w),
		wrong: num(r, 'wrong', w),
		startedAt: num(r, 'startedAt', w),
		endedAt: num(r, 'endedAt', w)
	}));

	const highscores = list<Highscore>(file, 'highscores', 'highscore', (r, w) => ({
		listId: str(r, 'listId', w, false),
		direction: oneOf(r, 'direction', SESSION_DIRECTIONS, w),
		mode: oneOf(r, 'mode', MODES, w),
		score: num(r, 'score', w),
		achievedAt: num(r, 'achievedAt', w)
	}));

	const activity = list<ActivityDay>(file, 'activity', 'activiteitsdag', (r, w) => {
		const date = str(r, 'date', w);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(`${w} heeft een ongeldige datum.`);
		return { date, xp: num(r, 'xp', w) };
	});

	if (file.profile === undefined) fail('het profiel ontbreekt.');
	const profile = parseProfile(file.profile);

	return { app: 'level-up', format: 1, exportedAt, lists, items, progress, reviews, sessions, highscores, profile, activity };
}

/** Vult ontbrekende velden van een ouder profielrecord aan met de standaardwaarden. */
export function completeProfile(stored: Partial<Profile>, createdAt: number): Profile {
	return {
		...DEFAULT_PROFILE,
		...stored,
		intervalsDays: [...(stored.intervalsDays ?? DEFAULT_PROFILE.intervalsDays)],
		createdAt: stored.createdAt ?? createdAt
	} as Profile;
}
