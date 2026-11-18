// Sessie-engine voor oefenen (leermodus en speedrun). Geen UI-afhankelijkheden: de UI leest de
// reactieve velden en roept submitAnswer/selectChoice/next/overrideAsCorrect/quit/tick aan.
//
// Afspraken over voortgang (LD-01..LD-07):
// - Het eerste antwoord van een item in een sessie plant het item in (applyAnswer: goed = één bakje
//   omhoog, bijna goed = bakje blijft, fout = bakje 1). Een eerste "bijna goed" op een nieuw item (bakje 0)
//   plant niet in; het eerstvolgende antwoord doet dat dan alsnog.
// - Herhalingen binnen dezelfde sessie veranderen de planning niet meer, behalve dat een fout antwoord altijd
//   bakje 1 geeft. Ze leveren wel een review en (beperkte) XP op.
// - Voortgang, XP en activiteit worden per antwoord weggeschreven; de review van het laatste antwoord pas
//   zodra de feedback wordt verlaten (zodat "ik had het goed" hem nog kan corrigeren).
// - Stoppen (`quit`) bewaart niets extra's: geen sessierecord en geen highscore.
// - Een item dat in één sessie al 3 keer opnieuw is ingepland na een fout, wordt na een vierde fout niet meer\r\n//   teruggezet (voorkomt eindeloos herhalen); het komt de volgende dag terug.

import {
	POINTS_ALMOST,
	POINTS_CORRECT,
	SPEEDRUN_MIN_POOL,
	applyAnswer,
	buildCandidates,
	buildChoices,
	checkAnswer,
	dateKey,
	diffMarkup,
	expandAccepted,
	initialSpeedrunState,
	isDue,
	isNew,
	levelFromXp,
	masteryOfBox,
	selectLearnSession,
	selectSpeedrunPool,
	shuffle,
	speedrunStep,
	xpForAnswer,
	SPEEDRUN_START_SECONDS,
	type AnswerCheck,
	type AnswerReason,
	type AnswerResult,
	type Candidate,
	type Direction,
	type GameMode,
	type Item,
	type LevelInfo,
	type Mastery,
	type Profile,
	type Progress,
	type QuestionForm,
	type ReviewRecord,
	type SessionDirection,
	type SessionRecord,
	type SpeedrunState,
	type WordList
} from '#lib/domain/index.ts';
import type { DiffSegment } from '#lib/domain/answer.ts';
import type { Store } from '#lib/data/store.ts';
import { almostMessage, languageCodeOf, specialCharsFor } from './session-lang.ts';
import { drawFromBag, insertWithGap, pickGap, separateNeighbours } from './session-queue.ts';

export type SessionStatus =
	| 'not-found'
	| 'nothing-due'
	| 'needs-learning'
	| 'ready'
	| 'asking'
	| 'feedback'
	| 'finishing'
	| 'finished'
	| 'quit';

export const LEARN_SESSION_SIZE = 10;
export const LEARN_NEW_PER_SESSION = 5;
export const MAX_REQUEUES_PER_ITEM = 3;
export const CHOICE_COUNT = 4;

export interface QuestionView {
	id: number;
	itemId: string;
	direction: Direction;
	form: QuestionForm;
	prompt: string;
	/** Alleen bij meerkeuze. */
	options: string[];
	fromLang: string;
	toLang: string;
	/** Taalcode van het antwoord (voor het toetsenbord), indien bekend. */
	answerLang: string | undefined;
	specialChars: string[];
	/** Dit item is in deze sessie al eerder beantwoord. */
	repeat: boolean;
	/** Het item was nog niet geoefend toen de sessie begon. */
	isNew: boolean;
}

export interface FeedbackView {
	result: AnswerResult;
	correctAnswer: string;
	givenAnswer: string;
	/** Juiste antwoord met het verschil gemarkeerd (alleen bij 'bijna goed'). */
	segments: DiffSegment[] | undefined;
	/** Titel voor de feedbackbalk; undefined = standaardtitel. */
	message: string | undefined;
	reason: AnswerReason | undefined;
	xp: number;
	/** Voorbeeldzin; pas zichtbaar in de feedback. */
	example: string | undefined;
	canOverride: boolean;
	overridden: boolean;
	/** Alleen meerkeuze. */
	selectedIndex: number | null;
	correctIndex: number;
}

export interface ImprovedItem {
	itemId: string;
	direction: Direction;
	term: string;
	translation: string;
	from: Mastery;
	to: Mastery;
}

export interface SessionSummary {
	listId: string;
	direction: SessionDirection;
	mode: GameMode;
	score: number;
	xpEarned: number;
	correct: number;
	almost: number;
	wrong: number;
	/** Aantal beantwoorde vragen. */
	answered: number;
	maxCombo: number;
	durationMs: number;
	levelBefore: LevelInfo;
	levelAfter: LevelInfo;
	levelUp: boolean;
	/** Nieuw persoonlijk record (alleen speedrun). */
	newRecord: boolean;
	previousBest: number | null;
	/** Items die in deze sessie een hoger beheersingsniveau kregen. */
	improved: ImprovedItem[];
	/** Daarvan: items die nu beheerst zijn. */
	newlyMastered: ImprovedItem[];
}

export interface LoadSessionOptions {
	store: Store;
	listId: string;
	direction: SessionDirection;
	mode: GameMode;
	now: () => number;
	rng: () => number;
	/** Ook oefenen als er niets aan herhaling toe of nieuw is (leermodus). */
	extra?: boolean;
	/** false = pas starten met `start()` (speedrun met een "Klaar?"-scherm). Standaard true. */
	autoStart?: boolean;
	size?: number;
	newPerSession?: number;
}

interface Entry {
	key: string;
	form: QuestionForm;
	/** Vormen van de volgende herhalingen van dit item. */
	chain: QuestionForm[];
}

interface ItemState {
	cand: Candidate;
	progress: Progress | undefined;
	initialBox: number;
	planned: boolean;
	answered: number;
	wrongs: number;
	almostExtras: number;
}

interface CurrentQuestion {
	entry: Entry;
	form: QuestionForm;
	options: string[];
	correctIndex: number;
	startedAt: number;
}

interface AnswerRecord {
	key: string;
	form: QuestionForm;
	result: AnswerResult;
	check: AnswerCheck | null;
	given: string;
	selectedIndex: number | null;
	options: string[];
	correctIndex: number;
	at: number;
	xp: number;
	entry: Entry;
	inserted: Entry | null;
	review: ReviewRecord;
	dateKey: string;
	snapshot: {
		progress: Progress | undefined;
		planned: boolean;
		wrongs: number;
		almostExtras: number;
		tally: SpeedrunState;
	};
}

function learnStep(tally: SpeedrunState, result: AnswerResult): SpeedrunState {
	if (result === 'correct') {
		const combo = tally.combo + 1;
		return {
			...tally,
			combo,
			maxCombo: Math.max(tally.maxCombo, combo),
			score: tally.score + POINTS_CORRECT
		};
	}
	if (result === 'almost') return { ...tally, score: tally.score + POINTS_ALMOST };
	return { ...tally, combo: 0 };
}

const MASTERY_RANK: Record<Mastery, number> = { new: 0, practiced: 1, known: 2, mastered: 3 };
const keyOf = (c: { item: Item; direction: Direction }) => `${c.item.id}|${c.direction}`;
const tzOffset = (ms: number) => -new Date(ms).getTimezoneOffset();

export class PracticeSession {
	readonly list: WordList | null;
	readonly listId: string;
	readonly mode: GameMode;
	readonly direction: SessionDirection;
	/** Speedrun: totale starttijd in ms (voor de timerbalk). */
	readonly totalMs = SPEEDRUN_START_SECONDS * 1000;
	/** Bij 'needs-learning': aantal bruikbare items en het minimum. */
	readonly poolSize: number;
	readonly minPool = SPEEDRUN_MIN_POOL;
	/** Bij 'nothing-due': waarom er niets te doen is. */
	readonly emptyReason: 'empty-list' | 'up-to-date' | null;

	status = $state<SessionStatus>('ready');
	question = $state.raw<QuestionView | null>(null);
	feedback = $state.raw<FeedbackView | null>(null);
	summary = $state.raw<SessionSummary | null>(null);
	/** Score, combo, maximale combo en resterende tijd (ms). */
	tally = $state.raw<SpeedrunState>(initialSpeedrunState());
	xpEarned = $state(0);
	answered = $state(0);
	/** 1-based nummer van de huidige vraag en het (groeiende) totaal. Speedrun: total = 0. */
	index = $state(0);
	total = $state(0);
	/** 0..1, loopt nooit terug. */
	progress = $state(0);
	counts = $state.raw({ correct: 0, almost: 0, wrong: 0 });
	/** Laatst bekende opslagfout (de sessie loopt gewoon door). */
	saveError = $state<string | null>(null);

	readonly #store: Store;
	readonly #items: Item[];
	readonly #profile: Profile | null;
	readonly #now: () => number;
	readonly #rng: () => number;
	readonly #states = new Map<string, ItemState>();
	readonly #sessionId: string;
	readonly #fromLang: string;
	readonly #toLang: string;
	readonly #targetCode: string | undefined;
	readonly #sourceCode: string | undefined;
	#startXp = 0;
	#startedAt = 0;
	#queue: Entry[] = [];
	#initialCount = 0;
	#insertedCount = 0;
	#bag: Entry[] = [];
	#pool: Candidate[] = [];
	#last: { key: string; itemId: string } | null = null;
	#current: CurrentQuestion | null = null;
	#lastAnswer: AnswerRecord | null = null;
	#pendingReview: ReviewRecord | null = null;
	#results: AnswerRecord[] = [];
	#questionCounter = 0;
	#lastTickAt = 0;
	#chain: Promise<void> = Promise.resolve();

	constructor(setup: {
		store: Store;
		list: WordList | null;
		listId: string;
		items: Item[];
		progress: Progress[];
		profile: Profile | null;
		mode: GameMode;
		direction: SessionDirection;
		now: () => number;
		rng: () => number;
		extra: boolean;
		size: number;
		newPerSession: number;
	}) {
		this.#store = setup.store;
		this.list = setup.list;
		this.listId = setup.listId;
		this.#items = setup.items;
		this.#profile = setup.profile;
		this.mode = setup.mode;
		this.direction = setup.direction;
		this.#now = setup.now;
		this.#rng = setup.rng;
		this.#startXp = setup.profile?.xp ?? 0;
		this.#fromLang = setup.list?.source ?? '';
		this.#toLang = setup.list?.target ?? '';
		this.#sourceCode = languageCodeOf(this.#fromLang);
		this.#targetCode = languageCodeOf(this.#toLang);
		this.#sessionId = `session-${setup.now()}-${Math.floor(setup.rng() * 1e9).toString(36)}`;

		let poolSize = 0;
		let emptyReason: 'empty-list' | 'up-to-date' | null = null;
		let status: SessionStatus = 'ready';

		if (!setup.list || !setup.profile) {
			status = 'not-found';
		} else if (setup.items.length === 0) {
			status = 'nothing-due';
			emptyReason = 'empty-list';
		} else {
			const cands = buildCandidates(setup.items, setup.progress, setup.direction, setup.rng);
			const now = setup.now();
			if (setup.mode === 'speedrun') {
				this.#pool = selectSpeedrunPool(cands);
				poolSize = this.#pool.length;
				if (poolSize < SPEEDRUN_MIN_POOL) status = 'needs-learning';
				else {
					for (const c of this.#pool) this.#register(c);
					this.tally = { ...initialSpeedrunState() };
				}
			} else if (!setup.extra && !cands.some((c) => isNew(c.progress) || isDue(c.progress, now))) {
				status = 'nothing-due';
				emptyReason = 'up-to-date';
			} else {
				const selected = selectLearnSession(
					cands,
					now,
					{ size: setup.size, newPerSession: setup.newPerSession },
					setup.rng
				);
				for (const c of selected) this.#register(c);
				const entries = selected.map<Entry>((c) =>
					isNew(c.progress)
						? { key: keyOf(c), form: 'choice', chain: ['typing'] }
						: { key: keyOf(c), form: 'typing', chain: [] }
				);
				this.#queue = separateNeighbours(entries, (e) => this.#states.get(e.key)!.cand.item.id);
				this.#initialCount = this.#queue.length;
			}
		}

		this.poolSize = poolSize;
		this.emptyReason = emptyReason;
		this.status = status;
	}

	#register(c: Candidate) {
		this.#states.set(keyOf(c), {
			cand: c,
			progress: c.progress,
			initialBox: c.progress?.box ?? 0,
			planned: false,
			answered: 0,
			wrongs: 0,
			almostExtras: 0
		});
	}

	/** Aantal vragen dat de sessie in het begin telt (leermodus). */
	get plannedCount(): number {
		return this.#initialCount;
	}

	get combo(): number {
		return this.tally.combo;
	}
	get score(): number {
		return this.tally.score;
	}
	get timeLeftMs(): number {
		return this.tally.timeLeftMs;
	}
	get level(): LevelInfo {
		return levelFromXp(this.#startXp + this.xpEarned);
	}
	get canOverride(): boolean {
		return this.status === 'feedback' && !!this.feedback?.canOverride;
	}

	/** Start de sessie (leermodus: automatisch via loadSession). */
	start(): void {
		if (this.status !== 'ready') return;
		this.#startedAt = this.#now();
		this.#ask();
	}

	/** Speedrun: laat de tijd lopen tot `nowMs`. Alleen tijdens een vraag loopt de tijd. */
	tick(nowMs: number = this.#now()): void {
		if (this.mode !== 'speedrun' || this.status !== 'asking') return;
		const delta = Math.max(0, nowMs - this.#lastTickAt);
		this.#lastTickAt = Math.max(this.#lastTickAt, nowMs);
		if (delta === 0) return;
		const timeLeftMs = Math.max(0, this.tally.timeLeftMs - delta);
		this.tally = { ...this.tally, timeLeftMs };
		if (timeLeftMs <= 0) this.#beginFinish();
	}

	submitAnswer(input: string): void {
		this.tick();
		const cur = this.#current;
		if (this.status !== 'asking' || !cur || cur.form !== 'typing') return;
		const st = this.#states.get(cur.entry.key)!;
		const { accepted } = expandAccepted(st.cand.item, st.cand.direction);
		const check = checkAnswer(input, accepted, { strictAccents: this.#profile?.strictAccents ?? false });
		this.#processAnswer(check.result, input.trim(), check, null);
	}

	selectChoice(index: number): void {
		this.tick();
		const cur = this.#current;
		if (this.status !== 'asking' || !cur || cur.form !== 'choice') return;
		if (!Number.isInteger(index) || index < 0 || index >= cur.options.length) return;
		this.#processAnswer(index === cur.correctIndex ? 'correct' : 'wrong', cur.options[index], null, index);
	}

	/** Verlaat de feedback en toont de volgende vraag of het resultaat. */
	next(): void {
		if (this.status !== 'feedback') return;
		this.#commitReview();
		this.feedback = null;
		this.#lastAnswer = null;
		this.#current = null;
		this.#ask();
	}

	/** LD-09: telt het laatste (getypte) antwoord alsnog als goed. */
	overrideAsCorrect(): void {
		const rec = this.#lastAnswer;
		if (this.status !== 'feedback' || !rec || !this.feedback?.canOverride) return;
		const st = this.#states.get(rec.key)!;

		st.progress = rec.snapshot.progress;
		st.planned = rec.snapshot.planned;
		st.wrongs = rec.snapshot.wrongs;
		st.almostExtras = rec.snapshot.almostExtras;
		if (rec.inserted) {
			const at = this.#queue.indexOf(rec.inserted);
			if (at >= 0) this.#queue.splice(at, 1);
			this.#insertedCount--;
		}

		this.tally = this.#stepTally(rec.snapshot.tally, 'correct').tally;
		const xp = this.#xpFor(st, 'correct', rec.form, this.tally.combo, rec.at, st.answered > 1);
		const delta = xp - rec.xp;
		this.xpEarned += delta;
		this.#applyProgress(st, 'correct', rec.at);
		rec.result = 'correct';
		rec.xp = xp;
		rec.review = { ...rec.review, result: 'correct' };
		this.#pendingReview = rec.review;
		rec.inserted = this.#afterAnswer(rec.entry, st, 'correct');
		this.#refreshCounts();
		this.#refreshProgress();

		this.#persistProgress(st);
		if (delta !== 0) this.#persistXp(delta, rec.dateKey);

		this.feedback = {
			...this.feedback!,
			result: 'correct',
			xp,
			message: 'Goed gerekend!',
			reason: undefined,
			segments: undefined,
			canOverride: false,
			overridden: true
		};
	}

	/** Stopt de sessie. Alles wat al is beantwoord blijft bewaard. */
	quit(): void {
		if (this.status === 'finishing' || this.status === 'finished' || this.status === 'quit') return;
		this.#commitReview();
		this.status = 'quit';
		this.question = null;
		this.feedback = null;
	}

	/** Wacht tot alle opslagacties klaar zijn (en het resultaat bekend is). */
	async flush(): Promise<void> {
		let current: Promise<void>;
		do {
			current = this.#chain;
			await current;
		} while (current !== this.#chain);
	}

	// ---- vragen kiezen ----

	#ask() {
		let entry: Entry | undefined;
		if (this.mode === 'speedrun') {
			entry = this.#drawSpeedrunEntry();
		} else {
			entry = this.#queue.shift();
		}
		if (!entry) {
			this.#beginFinish();
			return;
		}

		const st = this.#states.get(entry.key)!;
		const { item, direction } = st.cand;
		let form = entry.form;
		let options: string[] = [];
		let correctIndex = -1;
		if (form === 'choice') {
			const built = buildChoices(item, this.#items, direction, CHOICE_COUNT, this.#rng);
			if (built.options.length >= 2) {
				options = built.options;
				correctIndex = built.correctIndex;
			} else {
				// Te weinig afleiders: typen, en de aparte typvraag erna vervalt.
				form = 'typing';
				entry = { ...entry, form, chain: entry.chain[0] === 'typing' ? entry.chain.slice(1) : entry.chain };
			}
		}

		const { prompt } = expandAccepted(item, direction);
		const forward = direction === 'forward';
		const answerLang = forward ? this.#targetCode : this.#sourceCode;
		this.#current = { entry, form, options, correctIndex, startedAt: this.#now() };
		this.#lastTickAt = this.#current.startedAt;
		this.question = {
			id: ++this.#questionCounter,
			itemId: item.id,
			direction,
			form,
			prompt,
			options,
			fromLang: forward ? this.#fromLang : this.#toLang,
			toLang: forward ? this.#toLang : this.#fromLang,
			answerLang,
			specialChars: specialCharsFor(answerLang),
			repeat: st.answered > 0,
			isNew: st.initialBox === 0
		};
		this.feedback = null;
		this.status = 'asking';
		this.#refreshProgress();
	}

	#drawSpeedrunEntry(): Entry | undefined {
		if (this.#bag.length === 0) {
			this.#bag = shuffle(this.#pool, this.#rng).map((c) => ({ key: keyOf(c), form: 'typing', chain: [] }));
		}
		const entry = drawFromBag(
			this.#bag,
			(e) => e.key,
			(e) => this.#states.get(e.key)!.cand.item.id,
			this.#last
		);
		if (entry) this.#last = { key: entry.key, itemId: this.#states.get(entry.key)!.cand.item.id };
		return entry;
	}

	// ---- antwoord verwerken ----

	#stepTally(tally: SpeedrunState, result: AnswerResult): { tally: SpeedrunState } {
		if (this.mode === 'speedrun') return { tally: speedrunStep(tally, result).state };
		return { tally: learnStep(tally, result) };
	}

	#xpFor(
		st: ItemState,
		result: AnswerResult,
		form: QuestionForm,
		combo: number,
		at: number,
		repeatInSession: boolean
	): number {
		return xpForAnswer({
			result,
			boxBefore: st.progress?.box ?? 0,
			overdue: isDue(st.progress, at),
			mode: this.mode,
			combo,
			form,
			repeatInSession
		});
	}

	#applyProgress(st: ItemState, result: AnswerResult, at: number) {
		if (st.planned && result !== 'wrong') return;
		const { item, direction } = st.cand;
		st.progress = applyAnswer(
			st.progress,
			{ itemId: item.id, listId: this.listId, direction },
			result,
			at,
			this.#profile!.intervalsDays
		);
		st.planned = st.progress.dueAt !== null;
	}

	#processAnswer(result: AnswerResult, given: string, check: AnswerCheck | null, selected: number | null) {
		const cur = this.#current!;
		const st = this.#states.get(cur.entry.key)!;
		const at = this.#now();
		const { item, direction } = st.cand;
		const snapshot = {
			progress: st.progress,
			planned: st.planned,
			wrongs: st.wrongs,
			almostExtras: st.almostExtras,
			tally: this.tally
		};

		this.tally = this.#stepTally(this.tally, result).tally;
		const xp = this.#xpFor(st, result, cur.form, this.tally.combo, at, st.answered > 0);
		this.#applyProgress(st, result, at);
		st.answered++;
		if (result === 'wrong') st.wrongs++;
		this.answered++;
		this.xpEarned += xp;

		const review: ReviewRecord = {
			id: `${this.#sessionId}-${this.answered}`,
			sessionId: this.#sessionId,
			itemId: item.id,
			listId: this.listId,
			direction,
			result,
			form: cur.form,
			answerTimeMs: Math.max(0, at - cur.startedAt),
			at
		};
		const day = dateKey(at, tzOffset(at));
		const inserted = this.mode === 'learn' ? this.#afterAnswer(cur.entry, st, result) : null;
		const rec: AnswerRecord = {
			key: cur.entry.key,
			form: cur.form,
			result,
			check,
			given,
			selectedIndex: selected,
			options: cur.options,
			correctIndex: cur.correctIndex,
			at,
			xp,
			entry: cur.entry,
			inserted,
			review,
			dateKey: day,
			snapshot
		};
		this.#results.push(rec);
		this.#lastAnswer = rec;
		this.#pendingReview = review;
		this.#refreshCounts();

		this.#persistProgress(st);
		this.#persistXp(xp, day);

		const almost = result === 'almost';
		const feedback: FeedbackView = {
			result,
			correctAnswer: cur.form === 'choice' ? cur.options[cur.correctIndex] : (check?.expected ?? ''),
			givenAnswer: given,
			segments: almost && check ? diffMarkup(check.expected, given) : undefined,
			message: almost ? almostMessage(check?.reason) : undefined,
			reason: check?.reason,
			xp,
			example: item.example,
			canOverride: cur.form === 'typing' && result !== 'correct',
			overridden: false,
			selectedIndex: selected,
			correctIndex: cur.correctIndex
		};
		this.feedback = feedback;
		this.status = 'feedback';
		this.#refreshProgress();
	}

	/**
	 * Plant de volgende herhaling van een item in de rij (leermodus). Fout: minstens twee keer terug, waarvan
	 * minstens één typvraag. Bijna goed: één extra typvraag. Geeft de ingevoegde vraag terug.
	 */
	#afterAnswer(entry: Entry, st: ItemState, result: AnswerResult): Entry | null {
		if (this.mode !== 'learn') return null;
		let chain = entry.chain;
		if (result === 'wrong') {
			chain =
				st.wrongs > MAX_REQUEUES_PER_ITEM
					? []
					: entry.form === 'choice'
						? ['choice', 'typing']
						: ['typing', 'typing'];
		} else if (result === 'almost' && chain.length === 0 && st.almostExtras < 1) {
			st.almostExtras++;
			chain = ['typing'];
		}
		if (chain.length === 0) return null;
		const next: Entry = { key: entry.key, form: chain[0], chain: chain.slice(1) };
		insertWithGap(this.#queue, next, pickGap(this.#rng));
		this.#insertedCount++;
		return next;
	}

	#refreshCounts() {
		const counts = { correct: 0, almost: 0, wrong: 0 };
		for (const r of this.#results) counts[r.result]++;
		this.counts = counts;
	}

	#refreshProgress() {
		if (this.mode === 'speedrun') {
			this.index = this.answered + 1;
			this.total = 0;
			return;
		}
		const total = this.#initialCount + this.#insertedCount;
		this.total = total;
		this.index = Math.min(this.answered + (this.status === 'asking' ? 1 : 0), total);
		if (total > 0) this.progress = Math.max(this.progress, this.answered / total);
	}

	// ---- opslag ----

	#enqueue(task: () => Promise<void>) {
		this.#chain = this.#chain.then(task).catch((error: unknown) => {
			this.saveError = error instanceof Error ? error.message : String(error);
		});
	}

	#persistProgress(st: ItemState) {
		const progress = st.progress;
		if (progress) this.#enqueue(() => this.#store.progress.put(progress));
	}

	#persistXp(xp: number, day: string) {
		this.#enqueue(async () => {
			if (xp !== 0) {
				const profile = await this.#store.profile.get();
				await this.#store.profile.update({ xp: profile.xp + xp });
			}
			await this.#store.activity.record(day, xp);
		});
	}

	#commitReview() {
		const review = this.#pendingReview;
		this.#pendingReview = null;
		if (review) this.#enqueue(() => this.#store.reviews.add(review));
	}

	#beginFinish() {
		if (this.status === 'finishing' || this.status === 'finished' || this.status === 'quit') return;
		this.#commitReview();
		this.status = 'finishing';
		this.question = null;
		this.feedback = null;
		this.#enqueue(() => this.#finalize());
	}

	async #finalize() {
		const endedAt = this.#now();
		const { correct, almost, wrong } = this.counts;
		const levelBefore = levelFromXp(this.#startXp);
		const levelAfter = levelFromXp(this.#startXp + this.xpEarned);

		const improved: ImprovedItem[] = [];
		for (const st of this.#states.values()) {
			if (st.answered === 0 || !st.progress) continue;
			const from = masteryOfBox(st.initialBox);
			const to = masteryOfBox(st.progress.box);
			if (MASTERY_RANK[to] > MASTERY_RANK[from]) {
				improved.push({
					itemId: st.cand.item.id,
					direction: st.cand.direction,
					term: st.cand.item.term,
					translation: st.cand.item.translation,
					from,
					to
				});
			}
		}
		improved.sort((a, b) => MASTERY_RANK[b.to] - MASTERY_RANK[a.to]);

		let newRecord = false;
		let previousBest: number | null = null;
		try {
			if (this.answered > 0) {
				await this.#store.sessions.add({
					id: this.#sessionId,
					listId: this.listId,
					direction: this.direction,
					mode: this.mode,
					score: this.score,
					xpEarned: this.xpEarned,
					correct,
					almost,
					wrong,
					startedAt: this.#startedAt,
					endedAt
				} satisfies SessionRecord);
			}
			if (this.mode === 'speedrun' && this.score > 0) {
				previousBest = (await this.#store.highscores.get(this.listId, this.direction, 'speedrun'))?.score ?? null;
				newRecord = await this.#store.highscores.submit(
					this.listId,
					this.direction,
					'speedrun',
					this.score,
					endedAt
				);
			}
		} catch (error) {
			this.saveError = error instanceof Error ? error.message : String(error);
		}

		this.summary = {
			listId: this.listId,
			direction: this.direction,
			mode: this.mode,
			score: this.score,
			xpEarned: this.xpEarned,
			correct,
			almost,
			wrong,
			answered: this.answered,
			maxCombo: this.tally.maxCombo,
			durationMs: Math.max(0, endedAt - this.#startedAt),
			levelBefore,
			levelAfter,
			levelUp: levelAfter.level > levelBefore.level,
			newRecord,
			previousBest,
			improved,
			newlyMastered: improved.filter((i) => i.to === 'mastered')
		};
		this.status = 'finished';
	}
}

/** Laadt lijst, items, voortgang en profiel en bouwt de sessie. */
export async function loadSession(options: LoadSessionOptions): Promise<PracticeSession> {
	const { store, listId, direction, mode } = options;
	const list = (await store.lists.get(listId)) ?? null;
	const items = list ? await store.items.byList(listId) : [];
	const progress = list ? await store.progress.byList(listId) : [];
	const profile = list ? await store.profile.get() : null;
	const session = new PracticeSession({
		store,
		list,
		listId,
		items,
		progress,
		profile,
		mode,
		direction,
		now: options.now,
		rng: options.rng,
		extra: options.extra ?? false,
		size: options.size ?? LEARN_SESSION_SIZE,
		newPerSession: options.newPerSession ?? LEARN_NEW_PER_SESSION
	});
	if (options.autoStart ?? true) session.start();
	return session;
}
