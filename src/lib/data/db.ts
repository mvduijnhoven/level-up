import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
	ActivityDay, Highscore, Item, Profile, Progress, ReviewRecord, SessionRecord, WordList
} from '#lib/domain/types.ts';

export const DB_NAME = 'level-up';

export class LevelUpDB extends Dexie {
	lists!: EntityTable<WordList, 'id'>;
	items!: EntityTable<Item, 'id'>;
	progress!: Table<Progress, [string, string]>;
	reviews!: EntityTable<ReviewRecord, 'id'>;
	sessions!: EntityTable<SessionRecord, 'id'>;
	highscores!: Table<Highscore, [string, string, string]>;
	profile!: EntityTable<Profile, 'id'>;
	activity!: EntityTable<ActivityDay, 'date'>;

	constructor(name: string = DB_NAME) {
		super(name);
		// Migraties: voeg een nieuwe `this.version(n + 1).stores({ ...alleen gewijzigde tabellen }).upgrade((tx) => ...)`
		// toe onder deze versie; wijzig of verwijder nooit een bestaande versie.
		this.version(1).stores({
			lists: 'id',
			items: 'id, listId',
			progress: '[itemId+direction], listId, [listId+direction], dueAt',
			reviews: 'id, listId, itemId, at',
			sessions: 'id, listId, endedAt',
			highscores: '[listId+direction+mode]',
			profile: 'id',
			activity: 'date'
		});
	}
}
