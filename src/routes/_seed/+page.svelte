<script lang="ts">
	import { onMount } from 'svelte';
	import { getStore, installLibraryList } from '#lib/data/index.ts';
	import { resolve } from '$app/paths';

	let status = $state('bezig');
	onMount(async () => {
		const mode = new URLSearchParams(location.search).get('mode');
		const store = getStore();
		if (mode === 'list' || mode === 'progress') {
			const file = await (await fetch(resolve('/') + 'lists/fr-nl-basis-1.json')).json();
			await installLibraryList(store, file, Date.now());
		}
		if (mode === 'progress') {
			const lists = await store.lists.all();
			const items = await store.items.byList(lists[0].id);
			const now = Date.now();
			const rows = items.slice(0, 30).flatMap((item, i) => {
				const box = (i % 5) + 1;
				return [{ itemId: item.id, listId: item.listId, direction: 'forward' as const, box, dueAt: i % 3 === 0 ? now - 86400000 : now + 86400000 * 3, correct: 3, almost: 0, wrong: 1, lastPracticedAt: now - 3600000, updatedAt: now }];
			});
			await store.progress.bulkPut(rows);
			await store.profile.update({ xp: 135 });
			const d = (n: number) => { const x = new Date(Date.now() - n * 86400000); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
			await store.activity.record(d(0), 40);
			await store.activity.record(d(1), 30);
		}
		status = 'klaar';
	});
</script>

<p id="status">{status}</p>
