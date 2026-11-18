import type { AnswerResult, GameMode, QuestionForm } from './types.ts';

export interface XpInput {
	result: AnswerResult;
	/** Bakje van het item vóór dit antwoord. */
	boxBefore: number;
	/** Het item was aan herhaling toe (dueAt <= nu). */
	overdue: boolean;
	mode: GameMode;
	/** Aantal goede antwoorden op rij, dit antwoord meegeteld (alleen relevant in speedrun). */
	combo: number;
	form: QuestionForm;
	/** Het item is in dezelfde sessie al eerder beantwoord. */
	repeatInSession: boolean;
}

export const XP_CORRECT_TYPING = 10;
export const XP_CORRECT_CHOICE = 6;
export const XP_ALMOST = 4;
export const XP_REPEAT_CAP = 2;
export const XP_COMBO_STEP = 5;
export const XP_COMBO_MAX_BONUS = 5;

/**
 * XP voor één antwoord (BM-01, BM-02).
 *
 * basis:   goed = 10 (typen) of 6 (meerkeuze); bijna goed = 4; fout = 0
 * moeilijk: boxBefore >= 3 of overdue (maar niet bij een nieuw item, bakje 0) → basis × 1,5, afgerond
 * combo:   alleen speedrun en alleen bij goed: + floor(combo / 5), maximaal +5
 * herhaling: een item dat in dezelfde sessie al is beantwoord levert hoogstens 2 XP op
 */
export function xpForAnswer(p: XpInput): number {
	let xp = 0;
	if (p.result === 'correct') xp = p.form === 'typing' ? XP_CORRECT_TYPING : XP_CORRECT_CHOICE;
	else if (p.result === 'almost') xp = XP_ALMOST;
	if (xp === 0) return 0;

	if (p.boxBefore > 0 && (p.boxBefore >= 3 || p.overdue)) xp = Math.round(xp * 1.5);

	if (p.mode === 'speedrun' && p.result === 'correct') {
		xp += Math.min(Math.floor(Math.max(0, p.combo) / XP_COMBO_STEP), XP_COMBO_MAX_BONUS);
	}

	return p.repeatInSession ? Math.min(xp, XP_REPEAT_CAP) : xp;
}

export interface LevelInfo {
	level: number;
	xpIntoLevel: number;
	/** XP die het huidige niveau in totaal kost. */
	xpForNextLevel: number;
	/** 0..1, voortgang binnen het huidige niveau. */
	progress: number;
}

/** XP die nodig is om van niveau `level` naar `level + 1` te gaan: 50 + 25 × (level − 1). */
export function xpCostOfLevel(level: number): number {
	return 50 + 25 * (Math.max(1, level) - 1);
}

/** Niveau begint bij 1; niveau n kost 50 + 25 × (n − 1) XP. */
export function levelFromXp(xp: number): LevelInfo {
	let remaining = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
	let level = 1;
	let cost = xpCostOfLevel(level);
	while (remaining >= cost) {
		remaining -= cost;
		level++;
		cost = xpCostOfLevel(level);
	}
	return { level, xpIntoLevel: remaining, xpForNextLevel: cost, progress: remaining / cost };
}
