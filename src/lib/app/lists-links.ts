import { resolve } from '$app/paths';

// resolve() kent alleen bestaande routes; de overige adressen worden uit het basispad opgebouwd.
function basePath(): string {
	return resolve('/').replace(/\/+$/, '');
}

export const listsHref = (): string => resolve('/lists');
export const newListHref = (): string => resolve('/lists/new');
export const listHref = (id: string): string => resolve('/lists/[id]', { id });
export const practiceHref = (id: string): string => `${basePath()}/practice/${encodeURIComponent(id)}`;
export const libraryHref = (): string => `${basePath()}/library`;
