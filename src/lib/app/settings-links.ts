import { resolve } from '$app/paths';

/** Basispad zonder slash aan het eind, bijvoorbeeld "" of "/level-up". */
export function basePath(): string {
	return resolve('/').replace(/\/+$/, '');
}

export function practiceHref(listId: string): string {
	return `${basePath()}/practice/${encodeURIComponent(listId)}`;
}

export function newListHref(): string {
	return `${basePath()}/lists/new`;
}
