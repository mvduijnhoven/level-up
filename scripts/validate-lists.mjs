// Controleert static/lists/index.json en alle lijstbestanden. Gebruik: npm run validate:lists
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'static', 'lists');
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LANGUAGE_PATTERN = /^[a-z]{2,3}$/;
const errors = [];

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

async function readJson(file, label) {
	try {
		return JSON.parse(await readFile(file, 'utf8'));
	} catch (error) {
		errors.push(`${label}: kan niet worden gelezen als JSON (${error.message})`);
		return undefined;
	}
}

function checkHeader(data, label) {
	if (!isText(data.id)) errors.push(`${label}: "id" ontbreekt of is leeg`);
	else if (!ID_PATTERN.test(data.id)) errors.push(`${label}: id "${data.id}" is ongeldig (kleine letters, cijfers en streepjes)`);
	if (!Number.isInteger(data.version) || data.version < 1) errors.push(`${label}: "version" moet een geheel getal >= 1 zijn`);
	for (const key of ['title', 'source', 'target']) {
		if (!isText(data[key])) errors.push(`${label}: "${key}" ontbreekt of is leeg`);
	}
	for (const key of ['source', 'target']) {
		if (isText(data[key]) && !LANGUAGE_PATTERN.test(data[key])) {
			errors.push(`${label}: "${key}" moet een taalcode zijn (bijvoorbeeld "nl"), niet "${data[key]}"`);
		}
	}
}

function checkItems(items, label) {
	if (!Array.isArray(items) || items.length === 0) {
		errors.push(`${label}: "items" moet een niet-lege lijst zijn`);
		return 0;
	}
	const seen = new Set();
	items.forEach((item, index) => {
		const where = `${label}: item ${index + 1}${isObject(item) && isText(item.id) ? ` ("${item.id}")` : ''}`;
		if (!isObject(item)) return errors.push(`${where} is geen object`);
		if (!isText(item.id)) errors.push(`${where}: "id" ontbreekt of is leeg`);
		else if (!ID_PATTERN.test(item.id)) errors.push(`${where}: id is ongeldig (kleine letters, cijfers en streepjes, alleen ASCII)`);
		else if (seen.has(item.id)) errors.push(`${where}: dubbele id`);
		else seen.add(item.id);
		for (const key of ['term', 'translation']) {
			if (!isText(item[key])) errors.push(`${where}: "${key}" ontbreekt of is leeg`);
		}
		if (item.alternatives !== undefined) {
			if (!Array.isArray(item.alternatives) || !item.alternatives.every(isText)) {
				errors.push(`${where}: "alternatives" moet een lijst met niet-lege teksten zijn`);
			}
		}
		if (item.example !== undefined && !isText(item.example)) errors.push(`${where}: "example" mag niet leeg zijn`);
	});
	return items.length;
}

const catalog = await readJson(path.join(dir, 'index.json'), 'index.json');
if (catalog !== undefined) {
	if (!isObject(catalog) || !Array.isArray(catalog.lists)) {
		errors.push('index.json: "lists" moet een lijst zijn');
	} else {
		const ids = new Set();
		const files = new Set();
		for (const entry of catalog.lists) {
			const label = `index.json (${entry?.id ?? '?'})`;
			if (!isObject(entry)) {
				errors.push('index.json: een lijst-ingang is geen object');
				continue;
			}
			checkHeader(entry, label);
			if (ids.has(entry.id)) errors.push(`${label}: dubbele lijst-id`);
			ids.add(entry.id);
			if (!Number.isInteger(entry.itemCount) || entry.itemCount < 1) errors.push(`${label}: "itemCount" moet een geheel getal >= 1 zijn`);
			if (!isText(entry.file)) {
				errors.push(`${label}: "file" ontbreekt of is leeg`);
				continue;
			}
			if (entry.file !== path.basename(entry.file) || !entry.file.endsWith('.json')) {
				errors.push(`${label}: "file" moet een .json-bestand in de map lists zijn`);
				continue;
			}
			if (files.has(entry.file)) errors.push(`${label}: bestand "${entry.file}" komt dubbel voor`);
			files.add(entry.file);

			const filePath = path.join(dir, entry.file);
			if (!(await access(filePath).then(() => true, () => false))) {
				errors.push(`${label}: bestand "${entry.file}" bestaat niet`);
				continue;
			}
			const list = await readJson(filePath, entry.file);
			if (list === undefined) continue;
			if (!isObject(list)) {
				errors.push(`${entry.file}: moet een object zijn`);
				continue;
			}
			checkHeader(list, entry.file);
			for (const key of ['id', 'version', 'title', 'source', 'target']) {
				if (list[key] !== entry[key]) {
					errors.push(`${entry.file}: "${key}" (${JSON.stringify(list[key])}) wijkt af van de catalogus (${JSON.stringify(entry[key])})`);
				}
			}
			const count = checkItems(list.items, entry.file);
			if (count !== entry.itemCount) errors.push(`${entry.file}: ${count} items, maar itemCount in de catalogus is ${entry.itemCount}`);
		}
	}
}

if (errors.length > 0) {
	console.error(`Woordlijsten ongeldig (${errors.length} ${errors.length === 1 ? 'fout' : 'fouten'}):`);
	for (const message of errors) console.error(`  - ${message}`);
	process.exit(1);
}
console.log(`Woordlijsten geldig (${catalog.lists.length} ${catalog.lists.length === 1 ? 'lijst' : 'lijsten'}).`);
