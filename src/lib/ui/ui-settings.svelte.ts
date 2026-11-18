/** Gedeelde UI-instellingen; de layout koppelt `reduceMotion` aan de klasse `reduce-motion` op <html>. */
export const uiSettings = $state({ reduceMotion: false });

/** true als beweging beperkt moet worden: eigen schakelaar of systeeminstelling. */
export function shouldReduceMotion(): boolean {
	if (uiSettings.reduceMotion) return true;
	return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}