import { describe, expect, it } from 'vitest';
import { addDaysToKey, dateKey, weekProgress, weekStartKey } from './week.ts';

describe('dateKey', () => {
	it('gebruikt de opgegeven tijdzone-offset', () => {
		const ms = Date.UTC(2026, 0, 14, 23, 30); // 14 jan 23:30 UTC
		expect(dateKey(ms, 0)).toBe('2026-01-14');
		expect(dateKey(ms, 60)).toBe('2026-01-15');
		expect(dateKey(ms, -300)).toBe('2026-01-14');
		expect(dateKey(Date.UTC(2026, 0, 1, 0, 30), -60)).toBe('2025-12-31');
	});

	it('gebruikt lokale getters zonder offset', () => {
		const d = new Date(2026, 5, 3, 12, 0);
		expect(dateKey(d.getTime())).toBe('2026-06-03');
	});
});

describe('week', () => {
	it('start de week op maandag, ook vanaf zondag en over een jaargrens', () => {
		expect(weekStartKey('2026-11-16')).toBe('2026-11-16'); // maandag
		expect(weekStartKey('2026-11-22')).toBe('2026-11-16'); // zondag
		expect(weekStartKey('2026-01-01')).toBe('2025-12-29'); // donderdag
		expect(addDaysToKey('2026-02-28', 1)).toBe('2026-03-01');
	});

	it('geeft maandag t/m zondag met vandaag en toekomst gemarkeerd', () => {
		const w = weekProgress(['2026-11-16', '2026-11-18', '2026-11-18'], '2026-11-18', 4);
		expect(w.days.map((d) => d.date)).toEqual([
			'2026-11-16',
			'2026-11-17',
			'2026-11-18',
			'2026-11-19',
			'2026-11-20',
			'2026-11-21',
			'2026-11-22'
		]);
		expect(w.days.map((d) => d.active)).toEqual([true, false, true, false, false, false, false]);
		expect(w.days.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-11-18']);
		expect(w.days.map((d) => d.isFuture)).toEqual([false, false, false, true, true, true, true]);
		expect(w).toMatchObject({ activeCount: 2, goalDays: 4, reached: false });
	});

	it('telt alleen dagen in de huidige week en bereikt het doel exact', () => {
		const active = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-19', '2026-11-20', '2026-11-23'];
		const w = weekProgress(active, '2026-11-20', 4);
		expect(w.activeCount).toBe(4);
		expect(w.reached).toBe(true);
	});

	it('hoort zondag nog bij de week die maandag begon', () => {
		const w = weekProgress(['2026-11-22'], '2026-11-22', 1);
		expect(w.days[6]).toMatchObject({ date: '2026-11-22', isToday: true, active: true });
		expect(w.reached).toBe(true);
	});

	it('blijft kloppen rond de zomertijdwisseling', () => {
		const w = weekProgress([], '2026-03-29', 4); // zondag van de wisseling
		expect(w.days[0].date).toBe('2026-03-23');
		expect(w.days[6].date).toBe('2026-03-29');
	});
});
