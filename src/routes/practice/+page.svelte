<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getStore } from '#lib/data/index.ts';
	import { getListOverviews } from '#lib/app/stats.ts';
	import { listHref, listsHref, practiceHref } from '#lib/app/lists-links.ts';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import Button from '#lib/ui/Button.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import BookOpen from '@lucide/svelte/icons/book-open';

	let loading = $state(true);
	let empty = $state(false);

	onMount(async () => {
		try {
			const store = getStore();
			const overviews = await getListOverviews(store, Date.now());
			if (overviews.length === 0) {
				empty = true;
				loading = false;
				return;
			}
			// Kies eerst de lijst met de meeste achterstallige woorden, anders de eerste
			const sorted = [...overviews].sort((a, b) => b.totalDue - a.totalDue);
			const target = sorted[0];
			await goto(practiceHref(target.list.id), { replaceState: true });
		} catch {
			empty = true;
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Oefenen · Level Up</title>
</svelte:head>

<PageHeader title="Oefenen" />

{#if loading}
	<p class="muted" role="status">Lijst laden…</p>
{:else if empty}
	<EmptyState
		icon={BookOpen}
		title="Geen woordenlijsten gevonden"
		text="Maak eerst een lijst of kies er een uit de bibliotheek om te kunnen oefenen."
	>
		{#snippet action()}
			<Button variant="primary" href={listsHref()}>Naar lijsten</Button>
		{/snippet}
	</EmptyState>
{/if}
