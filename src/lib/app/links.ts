import { resolve } from '$app/paths';

/** Basispad zonder afsluitende slash ("" voor een eigen domein). */
export function basePath(): string {
	return resolve('/').replace(/\/+$/, '');
}

/** Bouwt een href uit basispad en pad, zonder dubbele slashes: `href('/practice/x')`. */
export function href(path: string): string {
	const clean = path.replace(/^\/+/, '');
	return clean ? `${basePath()}/${clean}` : resolve('/');
}
