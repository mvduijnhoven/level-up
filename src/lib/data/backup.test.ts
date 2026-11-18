// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBackup, readBackupFile } from './backup.ts';
import { LevelUpDB } from './db.ts';
import { createDexieStore } from './dexie-store.ts';
import { getStore, setStoreForTesting } from './index.ts';
import { estimateStorage, requestPersistentStorage } from './storage.ts';

afterEach(() => {
	vi.unstubAllGlobals();
	setStoreForTesting(null);
});

describe('readBackupFile', () => {
	it('leest JSON', async () => {
		expect(await readBackupFile(new File(['{"a":1}'], 'x.json'))).toEqual({ a: 1 });
	});

	it('geeft een Nederlandse fout bij ongeldige JSON', async () => {
		await expect(readBackupFile(new File(['geen json'], 'x.json'))).rejects.toThrow(/geen geldig back-upbestand/);
	});
});

describe('downloadBackup', () => {
	let db: LevelUpDB;
	beforeEach(() => {
		db = new LevelUpDB(`level-up-backup-test-${Date.now()}-${Math.random()}`);
	});
	afterEach(async () => {
		await db.delete();
	});

	it('maakt een download en onthoudt het exportmoment', async () => {
		const link = { href: '', download: '', style: {} as Record<string, string>, click: vi.fn(), remove: vi.fn() };
		vi.stubGlobal('document', { createElement: vi.fn(() => link), body: { append: vi.fn() } });
		vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
		const store = createDexieStore(db);
		await downloadBackup(store);
		expect(link.download).toMatch(/^level-up-backup-\d{4}-\d{2}-\d{2}\.json$/);
		expect(link.click).toHaveBeenCalled();
		expect((await store.profile.get()).lastExportAt).toBeGreaterThan(0);
	});
});

describe('storage', () => {
	it('is veilig zonder navigator.storage', async () => {
		vi.stubGlobal('navigator', {});
		expect(await requestPersistentStorage()).toBe(false);
		expect(await estimateStorage()).toBeNull();
	});

	it('vraagt blijvende opslag aan', async () => {
		vi.stubGlobal('navigator', {
			storage: { persisted: async () => false, persist: async () => true, estimate: async () => ({ usage: 1, quota: 2 }) }
		});
		expect(await requestPersistentStorage()).toBe(true);
		expect(await estimateStorage()).toEqual({ usage: 1, quota: 2 });
	});
});

describe('getStore', () => {
	it('geeft een singleton en laat zich vervangen', () => {
		const fake = {} as ReturnType<typeof createDexieStore>;
		setStoreForTesting(fake);
		expect(getStore()).toBe(fake);
	});
});
