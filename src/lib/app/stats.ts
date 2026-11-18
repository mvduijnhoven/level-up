import {
	countMastery, dateKey, isDue, isNew, levelFromXp, weekProgress, weekStartKey,
	type Direction, type Mastery, type Profile, type WordList
} from '#lib/domain/index.ts';
import type { Store } from '#lib/data/store.ts';

export const DIRECTIONS: readonly Direction[] = ['forward', 'backward'];

export interface ProfileSummary {
	profile: Profile;
	level: ReturnType<typeof levelFromXp>;
	week: ReturnType<typeof weekProgress>;
}

/** Profiel, niveau en weekvoortgang (maandag t/m zondag van de week waarin `now` valt). */
export async function getProfileSummary(store: Store, now: number): Promise<ProfileSummary> {
	const profile = await store.profile.get();
	const today = dateKey(now);
	const activity = await store.activity.since(weekStartKey(today));
	return {
		profile,
		level: levelFromXp(profile.xp),
		week: weekProgress(activity.map((day) => day.date), today, profile.weeklyGoalDays)
	};
}

export interface DirectionOverview {
	counts: Record<Mastery, number>;
	due: number;
	new: number;
}

export interface ListOverview {
	list: WordList;
	itemCount: number;
	perDirection: Record<Direction, DirectionOverview>;
	/** Som over beide richtingen. */
	totalDue: number;
	totalNew: number;
	lastPracticedAt: number | null;
}

/**
 * Overzicht per lijst. Items zonder voortgang tellen als nieuw. Gesorteerd op de meeste
 * achterstallige herhalingen, daarna op meest recent geoefend, daarna op titel.
 */
export async function getListOverviews(store: Store, now: number): Promise<ListOverview[]> {
	const lists = await store.lists.all();
	const overviews = await Promise.all(
		lists.map(async (list): Promise<ListOverview> => {
			const [items, progress] = await Promise.all([
				store.items.byList(list.id),
				store.progress.byList(list.id)
			]);
			const itemIds = new Set(items.map((item) => item.id));
			const known = progress.filter((p) => itemIds.has(p.itemId));

			const perDirection = {} as Record<Direction, DirectionOverview>;
			for (const direction of DIRECTIONS) {
				const own = known.filter((p) => p.direction === direction);
				const byItem = new Map(own.map((p) => [p.itemId, p]));
				let due = 0;
				let fresh = 0;
				for (const item of items) {
					const p = byItem.get(item.id);
					if (isDue(p, now)) due++;
					else if (isNew(p)) fresh++;
				}
				perDirection[direction] = { counts: countMastery(items, own), due, new: fresh };
			}

			let lastPracticedAt: number | null = null;
			for (const p of known) {
				if (p.lastPracticedAt !== null && (lastPracticedAt === null || p.lastPracticedAt > lastPracticedAt)) {
					lastPracticedAt = p.lastPracticedAt;
				}
			}

			return {
				list,
				itemCount: items.length,
				perDirection,
				totalDue: perDirection.forward.due + perDirection.backward.due,
				totalNew: perDirection.forward.new + perDirection.backward.new,
				lastPracticedAt
			};
		})
	);

	return overviews.sort(
		(a, b) =>
			b.totalDue - a.totalDue ||
			(b.lastPracticedAt ?? -1) - (a.lastPracticedAt ?? -1) ||
			a.list.title.localeCompare(b.list.title, 'nl')
	);
}
