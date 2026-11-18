import type { AnswerResult } from './types.ts';

export const SPEEDRUN_START_SECONDS = 60;
export const COMBO_BONUS_EVERY = 5;
export const COMBO_BONUS_SECONDS = 5;
export const MAX_TIME_SECONDS = 120;

export const POINTS_CORRECT = 10;
export const POINTS_ALMOST = 5;
/** Extra punten per volledige reeks van `COMBO_BONUS_EVERY` goede antwoorden op rij. */
export const POINTS_PER_COMBO_STEP = 2;

export interface SpeedrunState {
	combo: number;
	maxCombo: number;
	score: number;
	timeLeftMs: number;
}

export interface SpeedrunStep {
	state: SpeedrunState;
	/** Er is door de combo daadwerkelijk tijd bijgekomen (niet als de limiet al was bereikt). */
	bonusAwarded: boolean;
	timeAddedMs: number;
	pointsEarned: number;
}

export function initialSpeedrunState(): SpeedrunState {
	return { combo: 0, maxCombo: 0, score: 0, timeLeftMs: SPEEDRUN_START_SECONDS * 1000 };
}

/**
 * Verwerkt één antwoord.
 * - goed: combo + 1, 10 punten + floor(combo / 5) × 2; elke 5e goede op rij geeft + 5 s (max 120 s)
 * - bijna goed: combo blijft, 5 punten
 * - fout: combo terug naar 0, geen punten
 */
export function speedrunStep(state: SpeedrunState, result: AnswerResult): SpeedrunStep {
	if (result === 'wrong') {
		return { state: { ...state, combo: 0 }, bonusAwarded: false, timeAddedMs: 0, pointsEarned: 0 };
	}
	if (result === 'almost') {
		return {
			state: { ...state, score: state.score + POINTS_ALMOST },
			bonusAwarded: false,
			timeAddedMs: 0,
			pointsEarned: POINTS_ALMOST
		};
	}

	const combo = state.combo + 1;
	const pointsEarned =
		POINTS_CORRECT + Math.floor(combo / COMBO_BONUS_EVERY) * POINTS_PER_COMBO_STEP;
	const milestone = combo % COMBO_BONUS_EVERY === 0;
	const maxMs = MAX_TIME_SECONDS * 1000;
	const timeLeftMs = milestone
		? Math.max(state.timeLeftMs, Math.min(state.timeLeftMs + COMBO_BONUS_SECONDS * 1000, maxMs))
		: state.timeLeftMs;
	const timeAddedMs = timeLeftMs - state.timeLeftMs;
	return {
		state: {
			combo,
			maxCombo: Math.max(state.maxCombo, combo),
			score: state.score + pointsEarned,
			timeLeftMs
		},
		bonusAwarded: timeAddedMs > 0,
		timeAddedMs,
		pointsEarned
	};
}
