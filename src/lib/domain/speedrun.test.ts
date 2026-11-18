import { describe, expect, it } from 'vitest';
import {
	MAX_TIME_SECONDS,
	SPEEDRUN_START_SECONDS,
	initialSpeedrunState,
	speedrunStep,
	type SpeedrunState
} from './speedrun.ts';
import type { AnswerResult } from './types.ts';

function play(results: AnswerResult[], from: SpeedrunState = initialSpeedrunState()) {
	let state = from;
	const steps = results.map((r) => {
		const step = speedrunStep(state, r);
		state = step.state;
		return step;
	});
	return { state, steps };
}

describe('speedrunStep', () => {
	it('start met 60 seconden', () => {
		expect(initialSpeedrunState().timeLeftMs).toBe(SPEEDRUN_START_SECONDS * 1000);
	});

	it('geeft 10 punten per goed antwoord en verhoogt de combo', () => {
		const { state, steps } = play(['correct', 'correct']);
		expect(steps.map((s) => s.pointsEarned)).toEqual([10, 10]);
		expect(state).toMatchObject({ combo: 2, maxCombo: 2, score: 20, timeLeftMs: 60_000 });
	});

	it('geeft bij elke 5e goede op rij +5 seconden en combo-bonuspunten (floor(combo/5) × 2)', () => {
		const { state, steps } = play(Array(10).fill('correct'));
		expect(steps[3].bonusAwarded).toBe(false);
		expect(steps[4]).toMatchObject({ bonusAwarded: true, timeAddedMs: 5000, pointsEarned: 12 });
		expect(steps[8].pointsEarned).toBe(12);
		expect(steps[9]).toMatchObject({ bonusAwarded: true, pointsEarned: 14 });
		expect(state.timeLeftMs).toBe(70_000);
		expect(state.score).toBe(4 * 10 + 5 * 12 + 14);
	});

	it('zet de combo terug bij fout en behoudt maxCombo en score', () => {
		const { state, steps } = play(['correct', 'correct', 'correct', 'wrong', 'correct']);
		expect(steps[3]).toMatchObject({ pointsEarned: 0, bonusAwarded: false });
		expect(state).toMatchObject({ combo: 1, maxCombo: 3, score: 40 });
	});

	it('laat bij bijna goed de combo staan en geeft 5 punten zonder tijdbonus', () => {
		const { state, steps } = play(['correct', 'correct', 'almost', 'correct', 'correct', 'correct']);
		expect(steps[2].pointsEarned).toBe(5);
		expect(state.combo).toBe(5);
		expect(steps[5].bonusAwarded).toBe(true);
	});

	it('telt bijna goed niet mee voor de 5-op-een-rij-grens', () => {
		const { state } = play(['correct', 'correct', 'correct', 'correct', 'almost']);
		expect(state.combo).toBe(4);
		expect(state.timeLeftMs).toBe(60_000);
	});

	it('begrenst de tijd op 120 seconden', () => {
		const near: SpeedrunState = { combo: 4, maxCombo: 4, score: 0, timeLeftMs: 118_000 };
		const first = speedrunStep(near, 'correct');
		expect(first.state.timeLeftMs).toBe(MAX_TIME_SECONDS * 1000);
		expect(first.timeAddedMs).toBe(2000);
		const full: SpeedrunState = { combo: 9, maxCombo: 9, score: 0, timeLeftMs: 120_000 };
		const second = speedrunStep(full, 'correct');
		expect(second.state.timeLeftMs).toBe(120_000);
		expect(second.bonusAwarded).toBe(false);
	});

	it('wijzigt de invoerstatus niet', () => {
		const s = initialSpeedrunState();
		speedrunStep(s, 'correct');
		expect(s).toEqual(initialSpeedrunState());
	});
});
