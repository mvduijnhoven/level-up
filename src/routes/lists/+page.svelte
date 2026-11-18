<script lang="ts">
	import { onMount } from 'svelte';
	import { getStore } from '#lib/data/index.ts';
	import type { WordList } from '#lib/domain/types.ts';
	import { libraryHref, listHref, newListHref, practiceHref } from '#lib/app/lists-links.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Library from '@lucide/svelte/icons/library';
	import ListPlus from '@lucide/svelte/icons/list-plus';
	import Plus from '@lucide/svelte/icons/plus';
	import UserRound from '@lucide/svelte/icons/user-round';

	interface Entry {
		list: WordList;
		count: number;
	}

	let entries = $state<Entry[]>([]);
	let loading = $state(true);
	let loadError = $state('');

	onMount(async () => {
		try {
			const store = getStore();
			const lists = await store.lists.all();
			const loaded = await Promise.all(
				lists.map(async (list) => ({ list, count: await store.items.countByList(list.id) }))
			);
			entries = loaded.sort((a, b) => a.list.title.localeCompare(b.list.title, 'nl'));
		} catch {
			loadError = 'Je lijsten konden niet worden geladen. Ververs de pagina en probeer het opnieuw.';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Lijsten · Level Up</title>
</svelte:head>

<PageHeader title="Lijsten" subtitle="Je eigen woordenlijsten en lijsten uit de bibliotheek.">
	{#snippet action()}
		{#if entries.length > 0}
			<Button variant="primary" href={newListHref()}>
				<Plus size={20} aria-hidden="true" /> Nieuwe lijst
			</Button>
		{/if}
	{/snippet}
</PageHeader>

{#if loading}
	<p class="muted" role="status">Lijsten laden…</p>
{:else if loadError}
	<p class="load-error" role="alert">{loadError}</p>
{:else if entries.length === 0}
	<EmptyState
		title="Je hebt nog geen lijsten"
		text="Maak een eigen lijst met je woorden, of kies een kant-en-klare lijst uit de bibliotheek."
		icon={BookOpen}
	>
		{#snippet action()}
			<div class="empty-actions">
				<Button variant="primary" href={newListHref()}>
					<ListPlus size={20} aria-hidden="true" /> Eigen lijst maken
				</Button>
				<Button variant="secondary" href={libraryHref()}>
					<Library size={20} aria-hidden="true" /> Bibliotheek bekijken
				</Button>
			</div>
		{/snippet}
	</EmptyState>
{:else}
	<ul class="grid" role="list">
		{#each entries as { list, count } (list.id)}
			<Card as="li" class="list-card">
				<div class="head">
					<h2>{list.title}</h2>
					<p class="origin small">
						{#if list.origin === 'own'}
							<UserRound size={16} aria-hidden="true" /> Eigen lijst
						{:else}
							<Library size={16} aria-hidden="true" /> Bibliotheek
						{/if}
					</p>
				</div>
				<p class="muted">
					{list.source} → {list.target} · <span class="num">{count}</span>
					{count === 1 ? 'woord' : 'woorden'}
				</p>
				<div class="buttons">
					<Button variant="primary" href={practiceHref(list.id)} disabled={count === 0}>Oefenen</Button>
					<Button variant="secondary" href={listHref(list.id)}>Beheren</Button>
				</div>
				{#if count === 0}
					<p class="small muted">Voeg eerst woorden toe om te kunnen oefenen.</p>
				{/if}
			</Card>
		{/each}
	</ul>
{/if}

<style>
	.grid {
		display: grid;
		gap: var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	@media (min-width: 720px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.grid :global(.list-card) {
		display: grid;
		align-content: start;
		gap: var(--space-3);
	}

	.head {
		display: grid;
		gap: var(--space-1);
	}

	h2 {
		overflow-wrap: anywhere;
	}

	.origin {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-text-muted);
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.empty-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-3);
	}

	.load-error {
		color: var(--color-error);
	}
</style>
