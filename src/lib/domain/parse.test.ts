import { describe, expect, it } from 'vitest';
import { parseWordList, serializeWordList } from './parse.ts';

describe('parseWordList – scheidingsteken', () => {
	it('herkent tabs', () => {
		const r = parseWordList('het huis\tla maison\nde hond\tle chien');
		expect(r.delimiter).toBe('tab');
		expect(r.items).toEqual([
			{ term: 'het huis', translation: 'la maison', alternatives: [] },
			{ term: 'de hond', translation: 'le chien', alternatives: [] }
		]);
		expect(r.errors).toEqual([]);
	});

	it('herkent komma\'s en =', () => {
		expect(parseWordList('huis,maison\nhond,chien').delimiter).toBe('comma');
		const r = parseWordList('huis = la maison\nhond = le chien');
		expect(r.delimiter).toBe('equals');
		expect(r.items[1]).toMatchObject({ term: 'hond', translation: 'le chien' });
	});

	it('kiest het scheidingsteken van de meeste regels', () => {
		const r = parseWordList('a\tb\nc\td\ne,f');
		expect(r.delimiter).toBe('tab');
		expect(r.items).toHaveLength(2);
		expect(r.errors).toEqual([{ line: 3, message: expect.stringContaining('tab') }]);
	});

	it('laat komma\'s in tab-gescheiden tekst intact', () => {
		const r = parseWordList('hallo\tbonjour, salut\nhoi\tsalut');
		expect(r.delimiter).toBe('tab');
		expect(r.items[0].translation).toBe('bonjour, salut');
	});

	it('geeft delimiter null en fouten als nergens een scheidingsteken staat', () => {
		const r = parseWordList('alleen een woord\nnog een');
		expect(r.delimiter).toBeNull();
		expect(r.items).toEqual([]);
		expect(r.errors.map((e) => e.line)).toEqual([1, 2]);
	});
});

describe('parseWordList – kolommen', () => {
	it('splitst synoniemen op | en ;', () => {
		const r = parseWordList('snel\trapide | vite; véloce');
		expect(r.items[0]).toMatchObject({
			translation: 'rapide',
			alternatives: ['vite', 'véloce']
		});
	});

	it('leest een voorbeeldzin uit kolom 3', () => {
		const r = parseWordList('huis\tla maison\tC’est ma maison.');
		expect(r.items[0].example).toBe('C’est ma maison.');
		expect(parseWordList('huis\tla maison').items[0]).not.toHaveProperty('example');
	});

	it('houdt komma\'s in de voorbeeldzin bij ongequote CSV bij elkaar', () => {
		const r = parseWordList('huis,la maison,Voici ma maison, elle est grande');
		expect(r.items[0].example).toBe('Voici ma maison, elle est grande');
	});
});

describe('parseWordList – CSV met aanhalingstekens', () => {
	it('behandelt komma\'s en dubbele aanhalingstekens binnen velden', () => {
		const r = parseWordList('"hallo, wereld","bonjour, le monde"\n"zeg ""ja""","dis ""oui"""');
		expect(r.delimiter).toBe('comma');
		expect(r.items).toEqual([
			{ term: 'hallo, wereld', translation: 'bonjour, le monde', alternatives: [] },
			{ term: 'zeg "ja"', translation: 'dis "oui"', alternatives: [] }
		]);
	});

	it('ondersteunt een veld dat over meerdere regels loopt en houdt regelnummers kloppend', () => {
		const r = parseWordList('"een\nregel",one\nhuis,house\n,leeg');
		expect(r.items[0].term).toBe('een\nregel');
		expect(r.items[1].term).toBe('huis');
		expect(r.errors).toEqual([{ line: 4, message: 'Het woord ontbreekt.' }]);
	});

	it('meldt een niet gesloten aanhalingsteken zonder de rest te verliezen', () => {
		const r = parseWordList('"kapot,x\nhuis,house');
		expect(r.errors).toEqual([{ line: 1, message: 'Een aanhalingsteken is niet gesloten.' }]);
		expect(r.items).toEqual([{ term: 'huis', translation: 'house', alternatives: [] }]);
	});
});

describe('parseWordList – regels en fouten', () => {
	it('slaat lege regels over, ondersteunt CRLF en BOM', () => {
		const r = parseWordList('\uFEFFa\tb\r\n\r\n   \r\nc\td\r\n');
		expect(r.items.map((i) => i.term)).toEqual(['a', 'c']);
		expect(r.errors).toEqual([]);
	});

	it('meldt een ontbrekende vertaling of term met het juiste regelnummer', () => {
		const r = parseWordList('a\tb\n\nhuis\t\n\tmaison\nok\tfine');
		expect(r.errors).toEqual([
			{ line: 3, message: 'De vertaling ontbreekt.' },
			{ line: 4, message: 'Het woord ontbreekt.' }
		]);
		expect(r.items).toHaveLength(2);
	});

	it('verwijdert dubbele regels (term + vertaling, hoofdletterongevoelig)', () => {
		const r = parseWordList('huis\tla maison\nHuis\tLa Maison\nhuis\tle logis');
		expect(r.items.map((i) => i.translation)).toEqual(['la maison', 'le logis']);
		expect(r.duplicates).toBe(1);
	});
});

describe('serializeWordList', () => {
	it('schrijft tab-gescheiden regels die weer te lezen zijn', () => {
		const items = [
			{ term: 'snel', translation: 'rapide', alternatives: ['vite'], example: 'Il est rapide.' },
			{ term: 'huis', translation: 'la maison', alternatives: [] },
			{ term: '"citaat"', translation: 'citation', alternatives: [] }
		];
		const text = serializeWordList(items);
		expect(text.split('\n')[0]).toBe('snel\trapide | vite\tIl est rapide.');
		const r = parseWordList(text);
		expect(r.errors).toEqual([]);
		expect(r.items).toEqual(items);
	});

	it('vervangt tabs en regeleinden in velden door spaties', () => {
		expect(serializeWordList([{ term: 'a\tb', translation: 'c\nd', alternatives: [] }])).toBe('a b\tc d');
	});
});
