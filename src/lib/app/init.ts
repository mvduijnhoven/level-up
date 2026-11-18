import { getStore, requestPersistentStorage } from '#lib/data/index.ts';
import { uiSettings } from '#lib/ui/ui-settings.svelte.ts';
import { appState } from './init.svelte.ts';
import { initPwa } from './pwa.svelte.ts';

export { appState };

let started = false;

/** Eenmalige initialisatie, aan te roepen vanuit de layout (alleen in de browser). */
export async function initApp(): Promise<void> {
	if (started || typeof document === 'undefined') return;
	started = true;

	document.documentElement.lang = 'nl';
	initPwa();

	try {
		const profile = await getStore().profile.get();
		uiSettings.reduceMotion = profile.reduceMotion;
	} catch {
		// Zonder profiel werkt de app met de standaardinstellingen verder.
	}
	appState.ready = true;

	void requestPersistentStorage();
}
