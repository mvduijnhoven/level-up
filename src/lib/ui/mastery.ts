import type { Mastery } from '#lib/domain/types.ts';

export const MASTERY_ORDER: readonly Mastery[] = ['new', 'practiced', 'known', 'mastered'];

export const MASTERY_LABELS: Record<Mastery, string> = {
	new: 'Nieuw',
	practiced: 'Geoefend',
	known: 'Bekend',
	mastered: 'Beheerst'
};

/** Aantal gevulde blokjes (van 3) per niveau (LD-01). */
export const MASTERY_BLOCKS: Record<Mastery, number> = {
	new: 0,
	practiced: 1,
	known: 2,
	mastered: 3
};