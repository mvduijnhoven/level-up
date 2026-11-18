// Gedeelde domeintypes. Dit bestand is het contract tussen domein-, data-, app- en UI-laag.
// Wijzig het alleen in overleg: alle lagen hangen hiervan af.

export type Direction = 'forward' | 'backward';
/** 'both' = heen en terug door elkaar in één sessie. */
export type SessionDirection = Direction | 'both';
export type Mastery = 'new' | 'practiced' | 'known' | 'mastered';
export type AnswerResult = 'correct' | 'almost' | 'wrong';
export type QuestionForm = 'choice' | 'typing';
export type GameMode = 'learn' | 'speedrun';

/** Bakje 0 = nog niet geoefend; bakjes 1..5 = Leitner-bakjes. */
export const MAX_BOX = 5;
/** Dagen tot de volgende herhaling voor bakje 1..5 (index = bakje - 1). */
export const DEFAULT_INTERVALS_DAYS: readonly number[] = [1, 3, 7, 14, 30];

export interface WordList {
	id: string;
	title: string;
	/** Weergavenaam van de brontaal, bijvoorbeeld "Nederlands". */
	source: string;
	/** Weergavenaam van de doeltaal, bijvoorbeeld "Frans". */
	target: string;
	origin: 'own' | 'library';
	/** Versie van de meegeleverde lijst; 1 voor eigen lijsten. */
	version: number;
	createdAt: number;
	updatedAt: number;
}

export interface Item {
	/** Voor eigen lijsten een UUID; voor bibliotheeklijsten `${listId}/${bibliotheek-item-id}`. */
	id: string;
	listId: string;
	/** Woord of zin in de brontaal. */
	term: string;
	/** Hoofdvertaling in de doeltaal. */
	translation: string;
	/** Extra goede antwoorden voor de vertaling (synoniemen). */
	alternatives: string[];
	/** Voorbeeldzin in de doeltaal. */
	example?: string;
	updatedAt: number;
}

export interface Progress {
	itemId: string;
	listId: string;
	direction: Direction;
	box: number;
	/** Tijdstip (ms) waarop het item aan herhaling toe is; null als het nog nooit is geoefend. */
	dueAt: number | null;
	correct: number;
	almost: number;
	wrong: number;
	lastPracticedAt: number | null;
	updatedAt: number;
}

export interface ReviewRecord {
	id: string;
	sessionId: string;
	itemId: string;
	listId: string;
	direction: Direction;
	result: AnswerResult;
	form: QuestionForm;
	answerTimeMs: number;
	at: number;
}

export interface SessionRecord {
	id: string;
	listId: string;
	direction: SessionDirection;
	mode: GameMode;
	score: number;
	xpEarned: number;
	correct: number;
	almost: number;
	wrong: number;
	startedAt: number;
	endedAt: number;
}

export interface Highscore {
	listId: string;
	direction: SessionDirection;
	mode: GameMode;
	score: number;
	achievedAt: number;
}

export interface Profile {
	id: 'profile';
	xp: number;
	/** Dagen per bakje 1..5; minimaal 1 en oplopend. */
	intervalsDays: number[];
	weeklyGoalDays: number;
	soundOn: boolean;
	vibrationOn: boolean;
	/** true = beweging beperken, ook als het systeem dat niet vraagt. */
	reduceMotion: boolean;
	/** Accenten tellen mee bij het nakijken. */
	strictAccents: boolean;
	lastExportAt: number | null;
	createdAt: number;
}

export const DEFAULT_PROFILE: Omit<Profile, 'createdAt'> = {
	id: 'profile',
	xp: 0,
	intervalsDays: [...DEFAULT_INTERVALS_DAYS],
	weeklyGoalDays: 4,
	soundOn: false,
	vibrationOn: false,
	reduceMotion: false,
	strictAccents: false,
	lastExportAt: null
};

/** Eén dag waarop is geoefend; `date` is een lokale datum als YYYY-MM-DD. */
export interface ActivityDay {
	date: string;
	xp: number;
}

export interface BackupFile {
	app: 'level-up';
	/** Versie van het bestandsformaat. */
	format: 1;
	exportedAt: number;
	lists: WordList[];
	items: Item[];
	progress: Progress[];
	reviews: ReviewRecord[];
	sessions: SessionRecord[];
	highscores: Highscore[];
	profile: Profile | null;
	activity: ActivityDay[];
}
