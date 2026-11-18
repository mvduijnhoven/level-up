import type {
	BackupFile, Direction, GameMode, Profile, SessionDirection
} from '#lib/domain/types.ts';
import { DEFAULT_PROFILE } from '#lib/domain/types.ts';
import { completeProfile, parseBackup } from './backup-format.ts';
import { LevelUpDB } from './db.ts';
import type { Store } from './store.ts';

// Bovengrens voor het doorzoeken van een samengestelde sleutel op alleen het voorvoegsel.
const MAX_STRING = '\uffff';

export function createDexieStore(db: LevelUpDB = new LevelUpDB()): Store {
	const allTables = () => db.tables;

	const deleteProgressOfItem = (itemId: string) =>
		db.progress
			.where('[itemId+direction]')
			.between([itemId, ''], [itemId, MAX_STRING])
			.delete();

	async function readProfile(): Promise<Profile> {
		return db.transaction('rw', db.profile, async () => {
			const stored = await db.profile.get('profile');
			if (!stored) {
				const created = completeProfile({ ...DEFAULT_PROFILE }, Date.now());
				await db.profile.put(created);
				return created;
			}
			const complete = completeProfile(stored, Date.now());
			const missing = Object.keys(DEFAULT_PROFILE).some((k) => !(k in stored)) || stored.createdAt === undefined;
			if (missing) await db.profile.put(complete);
			return complete;
		});
	}

	return {
		lists: {
			all: () => db.lists.toArray(),
			get: (id) => db.lists.get(id),
			async put(list) {
				await db.lists.put(list);
			},
			delete: (id) =>
				db.transaction(
					'rw',
					[db.lists, db.items, db.progress, db.reviews, db.sessions, db.highscores],
					async () => {
						await db.items.where('listId').equals(id).delete();
						await db.progress.where('listId').equals(id).delete();
						await db.reviews.where('listId').equals(id).delete();
						await db.sessions.where('listId').equals(id).delete();
						await db.highscores
							.where('[listId+direction+mode]')
							.between([id, '', ''], [id, MAX_STRING, MAX_STRING])
							.delete();
						await db.lists.delete(id);
					}
				)
		},

		items: {
			byList: (listId) => db.items.where('listId').equals(listId).toArray(),
			countByList: (listId) => db.items.where('listId').equals(listId).count(),
			async put(item) {
				await db.items.put(item);
			},
			async bulkPut(items) {
				await db.items.bulkPut(items);
			},
			delete: (id) =>
				db.transaction('rw', [db.items, db.progress], async () => {
					await deleteProgressOfItem(id);
					await db.items.delete(id);
				})
		},

		progress: {
			byList: (listId, direction?: Direction) =>
				direction
					? db.progress.where('[listId+direction]').equals([listId, direction]).toArray()
					: db.progress.where('listId').equals(listId).toArray(),
			get: (itemId, direction) => db.progress.get([itemId, direction]),
			async put(progress) {
				await db.progress.put(progress);
			},
			async bulkPut(progress) {
				await db.progress.bulkPut(progress);
			}
		},

		reviews: {
			async add(review) {
				await db.reviews.add(review);
			},
			byList: (listId) => db.reviews.where('listId').equals(listId).toArray()
		},

		sessions: {
			async add(session) {
				await db.sessions.add(session);
			},
			recent: (limit) => db.sessions.orderBy('endedAt').reverse().limit(limit).toArray()
		},

		highscores: {
			get: (listId: string, direction: SessionDirection, mode: GameMode) =>
				db.highscores.get([listId, direction, mode]),
			submit: (listId, direction, mode, score, at) =>
				db.transaction('rw', db.highscores, async () => {
					const current = await db.highscores.get([listId, direction, mode]);
					if (current && current.score >= score) return false;
					await db.highscores.put({ listId, direction, mode, score, achievedAt: at });
					return true;
				})
		},

		profile: {
			get: readProfile,
			update: (patch) =>
				db.transaction('rw', db.profile, async () => {
					const current = await readProfile();
					const next: Profile = { ...current, ...patch, id: 'profile' };
					await db.profile.put(next);
					return next;
				})
		},

		activity: {
			record: (date, xp) =>
				db.transaction('rw', db.activity, async () => {
					const day = await db.activity.get(date);
					await db.activity.put({ date, xp: (day?.xp ?? 0) + xp });
				}),
			since: (date) => db.activity.where('date').aboveOrEqual(date).toArray(),
			all: () => db.activity.orderBy('date').toArray()
		},

		exportAll: () =>
			db.transaction('r', allTables(), async (): Promise<BackupFile> => {
				const stored = await db.profile.get('profile');
				return {
					app: 'level-up',
					format: 1,
					exportedAt: Date.now(),
					lists: await db.lists.toArray(),
					items: await db.items.toArray(),
					progress: await db.progress.toArray(),
					reviews: await db.reviews.toArray(),
					sessions: await db.sessions.toArray(),
					highscores: await db.highscores.toArray(),
					profile: stored ? completeProfile(stored, Date.now()) : null,
					activity: await db.activity.toArray()
				};
			}),

		async importAll(file) {
			// Eerst volledig valideren; pas daarna wordt er iets aangeraakt.
			const data = parseBackup(file);
			await db.transaction('rw', allTables(), async () => {
				await Promise.all(allTables().map((t) => t.clear()));
				await db.lists.bulkPut(data.lists);
				await db.items.bulkPut(data.items);
				await db.progress.bulkPut(data.progress);
				await db.reviews.bulkPut(data.reviews);
				await db.sessions.bulkPut(data.sessions);
				await db.highscores.bulkPut(data.highscores);
				if (data.profile) await db.profile.put(data.profile);
				await db.activity.bulkPut(data.activity);
			});
		},

		clearAll: () =>
			db.transaction('rw', allTables(), async () => {
				await Promise.all(allTables().map((t) => t.clear()));
			})
	};
}

