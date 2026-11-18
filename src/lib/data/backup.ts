import type { Store } from './store.ts';

function localDate(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Downloadt alle gegevens als `level-up-backup-YYYY-MM-DD.json` en onthoudt het exportmoment. */
export async function downloadBackup(store: Store): Promise<void> {
	const backup = await store.exportAll();
	const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `level-up-backup-${localDate(new Date(backup.exportedAt))}.json`;
	link.style.display = 'none';
	document.body.append(link);
	link.click();
	link.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	await store.profile.update({ lastExportAt: backup.exportedAt });
}

/** Leest een gekozen back-upbestand; de inhoud wordt pas door `store.importAll` gecontroleerd. */
export async function readBackupFile(file: File): Promise<unknown> {
	let text: string;
	try {
		text = await file.text();
	} catch {
		throw new Error('Het bestand kon niet worden gelezen. Probeer het opnieuw.');
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new Error('Dit bestand is geen geldig back-upbestand: de inhoud is geen leesbare JSON.');
	}
}
