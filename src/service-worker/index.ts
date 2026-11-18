/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_PREFIX = 'levelup-';
const CACHE = `${CACHE_PREFIX}${version}`;
const NAVIGATION_TIMEOUT_MS = 4000;

// De scope van de worker is het basispad van de app (eindigt op een `/`).
const base = new URL(sw.registration.scope).pathname.replace(/\/$/, '');
const toUrl = (path: string) => `${base}/${path.replace(/^\//, '')}`;

const SPA_FALLBACK = toUrl('404.html');
const LISTS_PREFIX = toUrl('lists/');

const precacheUrls = [...immutable, ...assets]
	.map(({ path }) => path)
	.filter((path) => !/(^|\/)(CNAME|\.nojekyll)$/.test(path))
	.map(toUrl);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(precacheUrls);
			await cacheSpaShell(cache);
			// Geen skipWaiting: de nieuwe versie wacht op een bericht van de pagina.
		})()
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key))
			);
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') void sw.skipWaiting();
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(handleNavigation(request));
	} else if (url.pathname.startsWith(LISTS_PREFIX) && url.pathname.endsWith('.json')) {
		event.respondWith(staleWhileRevalidate(request, event));
	} else {
		event.respondWith(cacheFirst(request));
	}
});

// De SPA-schil (404.html) is geen build- of static-bestand en kan met status 404 worden geserveerd;
// we bewaren hem daarom zelf, als gewone 200-respons. Ontbreekt hij (dev), dan is dat geen fout.
async function cacheSpaShell(cache: Cache): Promise<void> {
	try {
		const response = await fetch(SPA_FALLBACK, { cache: 'reload' });
		const isHtml = response.headers.get('Content-Type')?.includes('text/html');
		if (!isHtml) return;
		await cache.put(
			SPA_FALLBACK,
			new Response(await response.blob(), {
				status: 200,
				headers: { 'Content-Type': 'text/html; charset=utf-8' }
			})
		);
	} catch {
		// Offline of niet beschikbaar: de volgende installatie probeert het opnieuw.
	}
}
async function cachedFallback(): Promise<Response | undefined> {
	return (await caches.match(SPA_FALLBACK)) ?? (await caches.match(`${base}/`));
}

async function handleNavigation(request: Request): Promise<Response> {
	try {
		const response = await Promise.race([
			fetch(request),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('timeout')), NAVIGATION_TIMEOUT_MS)
			)
		]);
		// GitHub Pages antwoordt op een diepe link met 404 + 404.html; de SPA-schil is dan de goede inhoud.
		if (response.ok) return response;
		return (await cachedFallback()) ?? response;
	} catch {
		const fallback = await cachedFallback();
		if (fallback) return fallback;
		return new Response('Je bent offline en de app is nog niet opgeslagen.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' }
		});
	}
}

async function cacheFirst(request: Request): Promise<Response> {
	const cached = await caches.match(request);
	return cached ?? fetch(request);
}

async function staleWhileRevalidate(request: Request, event: ExtendableEvent): Promise<Response> {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);

	const refresh = fetch(request).then(async (response) => {
		if (response.ok) await cache.put(request, response.clone());
		return response;
	});

	if (cached) {
		event.waitUntil(refresh.catch(() => {}));
		return cached;
	}
	return refresh;
}

