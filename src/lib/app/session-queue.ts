// Kleine, pure hulpfuncties voor de vraagrij van een sessie.

/** Minimale afstand (in vragen) tot een herhaling van een fout beantwoord item: 3 of 4. */
export const RETRY_GAP_MIN = 3;
export const RETRY_GAP_MAX = 4;

/** Willekeurige afstand tussen RETRY_GAP_MIN en RETRY_GAP_MAX (inclusief). */
export function pickGap(rng: () => number): number {
	return RETRY_GAP_MIN + Math.floor(rng() * (RETRY_GAP_MAX - RETRY_GAP_MIN + 1));
}

/**
 * Zet `entry` zo in de resterende rij dat er `gap - 1` vragen tussen de huidige vraag en de herhaling
 * zitten; is de rij korter, dan komt de herhaling achteraan. Geeft de positie terug.
 */
export function insertWithGap<T>(remaining: T[], entry: T, gap: number): number {
	const index = Math.min(Math.max(gap - 1, 0), remaining.length);
	remaining.splice(index, 0, entry);
	return index;
}

/** Verwisselt waar mogelijk twee opeenvolgende vragen over hetzelfde item (bijvoorbeeld heen en terug). */
export function separateNeighbours<T>(entries: T[], itemIdOf: (entry: T) => string): T[] {
	const out = entries.slice();
	for (let i = 1; i < out.length; i++) {
		if (itemIdOf(out[i]) !== itemIdOf(out[i - 1])) continue;
		for (let j = i + 1; j < out.length; j++) {
			if (itemIdOf(out[j]) !== itemIdOf(out[i - 1])) {
				[out[i], out[j]] = [out[j], out[i]];
				break;
			}
		}
	}
	return out;
}

/**
 * Trekt het volgende element uit `bag` (en haalt het eruit), liefst een ander item dan `lastItemId`
 * en anders een andere vraag dan `lastKey`.
 */
export function drawFromBag<T>(
	bag: T[],
	keyOf: (entry: T) => string,
	itemIdOf: (entry: T) => string,
	last: { key: string; itemId: string } | null
): T | undefined {
	if (bag.length === 0) return undefined;
	let index = 0;
	if (last) {
		const differentItem = bag.findIndex((e) => itemIdOf(e) !== last.itemId);
		const differentKey = bag.findIndex((e) => keyOf(e) !== last.key);
		index = differentItem >= 0 ? differentItem : Math.max(differentKey, 0);
	}
	return bag.splice(index, 1)[0];
}
