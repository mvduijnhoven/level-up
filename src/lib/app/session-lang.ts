import type { AnswerReason } from '#lib/domain/answer.ts';

const CODES: Record<string, string> = {
	nederlands: 'nl',
	frans: 'fr',
	engels: 'en',
	duits: 'de',
	spaans: 'es',
	italiaans: 'it',
	latijn: 'la',
	grieks: 'el'
};

/** Taalcode bij een weergavenaam als "Frans"; undefined als de taal onbekend is. */
export function languageCodeOf(name: string): string | undefined {
	return CODES[name.trim().toLowerCase()];
}

const SPECIAL_CHARS: Record<string, string[]> = {
	fr: ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'ù', 'û', 'ü', 'œ'],
	nl: ['é', 'è', 'ë', 'ï', 'ö', 'ü'],
	de: ['ä', 'ö', 'ü', 'ß'],
	es: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'],
	it: ['à', 'è', 'é', 'ì', 'ò', 'ù'],
	la: ['ā', 'ē', 'ī', 'ō', 'ū']
};

/** Speciale tekens voor het invoerveld; leeg als de taal geen extra tekens nodig heeft of onbekend is. */
export function specialCharsFor(code: string | undefined): string[] {
	return (code && SPECIAL_CHARS[code]) || [];
}

const ALMOST_MESSAGES: Record<AnswerReason, string> = {
	accent: 'Bijna goed! Let op het accent.',
	case: 'Bijna goed! Let op de hoofdletters.',
	typo: 'Bijna goed! Let op de spelling.',
	article: 'Bijna goed! Vergeet het lidwoord niet.',
	punctuation: 'Bijna goed! Let op de leestekens.'
};

export function almostMessage(reason: AnswerReason | undefined): string {
	return (reason && ALMOST_MESSAGES[reason]) || 'Bijna goed!';
}
