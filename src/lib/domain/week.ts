const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number, width = 2): string {
	return String(n).padStart(width, '0');
}

/**
 * Lokale datum als YYYY-MM-DD. Zonder `tzOffsetMinutes` gelden de lokale getters van de omgeving.
 * Met `tzOffsetMinutes` het aantal minuten dat de tijdzone vóór loopt op UTC (CET = +60); dit is
 * dus het omgekeerde van `Date.getTimezoneOffset()`.
 */
export function dateKey(ms: number, tzOffsetMinutes?: number): string {
	if (tzOffsetMinutes === undefined) {
		const d = new Date(ms);
		return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}
	const d = new Date(ms + tzOffsetMinutes * 60_000);
	return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function keyToUtcMs(key: string): number {
	const [y, m, d] = key.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
}

function utcMsToKey(ms: number): string {
	const d = new Date(ms);
	return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Datumsleutel `days` dagen na (of vóór, bij negatief) `key`; rekent op kalenderdagen, dus DST-vrij. */
export function addDaysToKey(key: string, days: number): string {
	return utcMsToKey(keyToUtcMs(key) + days * DAY_MS);
}

/** Maandag van de week waarin `key` valt. */
export function weekStartKey(key: string): string {
	const weekday = new Date(keyToUtcMs(key)).getUTCDay();
	return addDaysToKey(key, -((weekday + 6) % 7));
}

export interface WeekDay {
	date: string;
	active: boolean;
	isToday: boolean;
	isFuture: boolean;
}

export interface WeekProgress {
	days: WeekDay[];
	activeCount: number;
	goalDays: number;
	reached: boolean;
}

/** De week van maandag t/m zondag waarin `todayKey` valt. */
export function weekProgress(
	activeDates: string[],
	todayKey: string,
	goalDays: number
): WeekProgress {
	const active = new Set(activeDates);
	const start = weekStartKey(todayKey);
	const days: WeekDay[] = [];
	for (let i = 0; i < 7; i++) {
		const date = addDaysToKey(start, i);
		days.push({
			date,
			active: active.has(date),
			isToday: date === todayKey,
			isFuture: date > todayKey
		});
	}
	const activeCount = days.filter((d) => d.active).length;
	return { days, activeCount, goalDays, reached: activeCount >= goalDays };
}
