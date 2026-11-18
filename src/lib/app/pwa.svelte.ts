export const pwa = $state({ updateAvailable: false, offlineReady: false });

let registration: ServiceWorkerRegistration | undefined;
let initialized = false;
let reloadOnTakeover = false;

function watchInstalling(worker: ServiceWorker | null): void {
	if (!worker) return;
	worker.addEventListener('statechange', () => {
		if (worker.state === 'installed' && navigator.serviceWorker.controller) {
			pwa.updateAvailable = true;
		}
	});
}

export function initPwa(): void {
	if (initialized || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
	initialized = true;

	const container = navigator.serviceWorker;
	const hadController = container.controller !== null;

	container.addEventListener('controllerchange', () => {
		if (reloadOnTakeover) location.reload();
	});

	// SvelteKit registreert de worker zelf; `ready` wacht daarop.
	container.ready
		.then((reg) => {
			registration = reg;
			if (!hadController) pwa.offlineReady = true;
			if (reg.waiting && container.controller) pwa.updateAvailable = true;
			watchInstalling(reg.installing);
			reg.addEventListener('updatefound', () => watchInstalling(reg.installing));

			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') reg.update().catch(() => {});
			});
		})
		.catch(() => {});
}

export function applyUpdate(): void {
	const waiting = registration?.waiting;
	if (!waiting) return;
	reloadOnTakeover = true;
	waiting.postMessage({ type: 'SKIP_WAITING' });
}
