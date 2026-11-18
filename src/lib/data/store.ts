import type {
	ActivityDay, BackupFile, Direction, GameMode, Highscore, Item, Profile, Progress,
	ReviewRecord, SessionDirection, SessionRecord, WordList
} from '#lib/domain/types.ts';

/** Opslag-interface. De app praat alleen hiermee, nooit rechtstreeks met IndexedDB. */
export interface Store {
	lists: {
		all(): Promise<WordList[]>;
		get(id: string): Promise<WordList | undefined>;
		put(list: WordList): Promise<void>;
		/** Verwijdert ook de bijbehorende items, voortgang, reviews, sessies en highscores. */
		delete(id: string): Promise<void>;
	};
	items: {
		byList(listId: string): Promise<Item[]>;
		countByList(listId: string): Promise<number>;
		put(item: Item): Promise<void>;
		bulkPut(items: Item[]): Promise<void>;
		/** Verwijdert ook de voortgang van de items. */
		delete(id: string): Promise<void>;
	};
	progress: {
		byList(listId: string, direction?: Direction): Promise<Progress[]>;
		get(itemId: string, direction: Direction): Promise<Progress | undefined>;
		put(progress: Progress): Promise<void>;
		bulkPut(progress: Progress[]): Promise<void>;
	};
	reviews: { add(review: ReviewRecord): Promise<void>; byList(listId: string): Promise<ReviewRecord[]> };
	sessions: { add(session: SessionRecord): Promise<void>; recent(limit: number): Promise<SessionRecord[]> };
	highscores: {
		get(listId: string, direction: SessionDirection, mode: GameMode): Promise<Highscore | undefined>;
		/** Bewaart de score alleen als die hoger is dan de huidige; geeft true bij een nieuw record. */
		submit(listId: string, direction: SessionDirection, mode: GameMode, score: number, at: number): Promise<boolean>;
	};
	profile: {
		/** Maakt het profiel met standaardwaarden aan als het nog niet bestaat. */
		get(): Promise<Profile>;
		update(patch: Partial<Omit<Profile, 'id'>>): Promise<Profile>;
	};
	activity: {
		/** Telt XP op bij de dag `date` (YYYY-MM-DD) en maakt de dag aan als die nog niet bestaat. */
		record(date: string, xp: number): Promise<void>;
		since(date: string): Promise<ActivityDay[]>;
		all(): Promise<ActivityDay[]>;
	};
	/** Alle gegevens als back-upbestand (AC-07). */
	exportAll(): Promise<BackupFile>;
	/** Vervangt alle gegevens door de inhoud van het back-upbestand. Gooit een Error met leesbare tekst bij een ongeldig bestand. */
	importAll(file: unknown): Promise<void>;
	clearAll(): Promise<void>;
}



