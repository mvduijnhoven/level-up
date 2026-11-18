import { describe, expect, it } from 'vitest';
import { checkAnswer, diffMarkup, editDistance, expandAccepted } from './answer.ts';

describe('checkAnswer – goed', () => {
	it('negeert hoofdletters, witruimte en eindleestekens', () => {
		expect(checkAnswer('  LA   Maison ! ', ['la maison']).result).toBe('correct');
		expect(checkAnswer('la maison.', ['la maison']).result).toBe('correct');
		expect(checkAnswer('Is het waar?', ['is het waar']).result).toBe('correct');
	});

	it('behandelt gedecomponeerde Unicode en typografische apostrof als gelijk', () => {
		expect(checkAnswer('e\u0301te\u0301', ['été']).result).toBe('correct');
		expect(checkAnswer('l’ami', ["l'ami"]).result).toBe('correct');
	});

	it('negeert accenten standaard', () => {
		const r = checkAnswer('ete', ['été']);
		expect(r).toMatchObject({ result: 'correct', matched: 'été' });
		expect(r.reason).toBeUndefined();
	});

	it('kiest het beste antwoord uit meerdere geaccepteerde', () => {
		const r = checkAnswer('la voiture', ['la bagnole', 'la voiture', 'l’auto']);
		expect(r).toMatchObject({ result: 'correct', matched: 'la voiture', expected: 'la voiture' });
	});
});

describe('checkAnswer – bijna goed', () => {
	it('geeft bij strikte accenten almost met reden accent', () => {
		expect(checkAnswer('ete', ['été'], { strictAccents: true })).toMatchObject({
			result: 'almost',
			reason: 'accent',
			expected: 'été'
		});
		expect(checkAnswer('éte', ['été'], { strictAccents: true }).result).toBe('almost');
		expect(checkAnswer('été', ['été'], { strictAccents: true }).result).toBe('correct');
	});

	it('geeft almost als het lidwoord ontbreekt', () => {
		expect(checkAnswer('maison', ['la maison'])).toMatchObject({
			result: 'almost',
			reason: 'article',
			matched: 'la maison'
		});
		expect(checkAnswer('ami', ["l'ami"]).reason).toBe('article');
		expect(checkAnswer('huis', ['het huis']).reason).toBe('article');
	});

	it('rekent een verkeerd lidwoord als fout', () => {
		expect(checkAnswer('le maison', ['la maison']).result).toBe('wrong');
	});

	it('staat één typfout toe vanaf 5 tekens', () => {
		expect(checkAnswer('maisn', ['maison']).reason).toBe('typo');
		expect(checkAnswer('maisson', ['maison'])).toMatchObject({ result: 'almost', reason: 'typo' });
		expect(checkAnswer('bonjuor', ['bonjour'])).toMatchObject({ result: 'almost', reason: 'typo' });
	});

	it('staat twee typfouten toe vanaf 10 tekens, niet daaronder', () => {
		expect(checkAnswer('anivrsair', ['anniversaire']).result).toBe('wrong');
		expect(checkAnswer('anniversiare', ['anniversaire']).result).toBe('almost');
		expect(checkAnswer('annivrsare', ['anniversaire']).result).toBe('almost');
		expect(checkAnswer('maixxn', ['maison']).result).toBe('wrong');
	});

	it('past typo-tolerantie toe op het woord na het lidwoord', () => {
		expect(checkAnswer('la maisn', ['la maison'])).toMatchObject({ result: 'almost', reason: 'typo' });
		expect(checkAnswer('la lit', ['la lot']).result).toBe('wrong'); // te kort voor tolerantie
	});

	it('geeft korte woorden geen typo-tolerantie', () => {
		expect(checkAnswer('chat', ['chut']).result).toBe('wrong');
		expect(checkAnswer('pain', ['pin']).result).toBe('wrong');
		expect(checkAnswer('les', ['des']).result).toBe('wrong');
	});

	it('geeft de voorkeur aan goed boven bijna goed bij meerdere antwoorden', () => {
		const r = checkAnswer('maison', ['maisons', 'maison']);
		expect(r).toMatchObject({ result: 'correct', matched: 'maison' });
	});
});

describe('checkAnswer – fout', () => {
	it('geeft fout bij leeg of alleen spaties/leestekens', () => {
		expect(checkAnswer('', ['la maison'])).toEqual({
			result: 'wrong',
			matched: null,
			expected: 'la maison'
		});
		expect(checkAnswer('   ', ['la maison']).result).toBe('wrong');
		expect(checkAnswer('?!', ['la maison']).result).toBe('wrong');
	});

	it('toont het eerste geaccepteerde antwoord bij fout', () => {
		expect(checkAnswer('chien', ['la maison', 'le logis'])).toMatchObject({
			result: 'wrong',
			matched: null,
			expected: 'la maison'
		});
	});

	it('is veilig bij een lege lijst met antwoorden', () => {
		expect(checkAnswer('x', []).result).toBe('wrong');
		expect(checkAnswer('x', ['', '  ']).expected).toBe('');
	});
});

describe('editDistance', () => {
	it('telt een omwisseling van twee letters als 1', () => {
		expect(editDistance('bonjuor', 'bonjour')).toBe(1);
		expect(editDistance('kitten', 'sitting')).toBe(3);
		expect(editDistance('', 'abc')).toBe(3);
	});
});

describe('expandAccepted', () => {
	const item = { term: 'het huis', translation: 'la maison', alternatives: ['le logis', 'la maison', ''] };
	it('geeft heen vertaling en alternatieven zonder dubbelen', () => {
		expect(expandAccepted(item, 'forward')).toEqual({
			prompt: 'het huis',
			accepted: ['la maison', 'le logis']
		});
	});
	it('geeft terug alleen de term', () => {
		expect(expandAccepted(item, 'backward')).toEqual({ prompt: 'la maison', accepted: ['het huis'] });
	});
});

describe('diffMarkup', () => {
	const joined = (segs: { text: string }[]) => segs.map((s) => s.text).join('');

	it('markeert ontbrekende of foute letters in de verwachte tekst', () => {
		const segs = diffMarkup('maison', 'maisn');
		expect(joined(segs)).toBe('maison');
		expect(segs).toEqual([
			{ text: 'mais', mismatch: false },
			{ text: 'o', mismatch: true },
			{ text: 'n', mismatch: false }
		]);
	});

	it('markeert niets bij een gelijk antwoord, ongeacht hoofdletters', () => {
		expect(diffMarkup('La Maison', 'la maison')).toEqual([{ text: 'La Maison', mismatch: false }]);
	});

	it('markeert een ander accent als verschil', () => {
		expect(diffMarkup('été', 'ete')).toEqual([
			{ text: 'é', mismatch: true },
			{ text: 't', mismatch: false },
			{ text: 'é', mismatch: true }
		]);
	});

	it('markeert alles bij een leeg antwoord en geeft niets bij lege verwachting', () => {
		expect(diffMarkup('chat', '')).toEqual([{ text: 'chat', mismatch: true }]);
		expect(diffMarkup('', 'x')).toEqual([]);
	});
});
