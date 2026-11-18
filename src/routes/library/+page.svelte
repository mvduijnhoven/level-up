<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import Library from '@lucide/svelte/icons/library';
	import { getStore } from '#lib/data/index.ts';
	import { languageName } from '#lib/data/library.ts';
	import type { WordList } from '#lib/domain/types.ts';
	import {
		describeInstall, installFromLibrary, loadInstalledLibraryLists, loadLibrary, wordsLabel,
		type LibraryViewItem
	} from '#lib/app/library-service.ts';
	import { basePath, newListHref, practiceHref } from '#lib/app/settings-links.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import { toasts } from '#lib/ui/toast.svelte.ts';

	let loading = $state(true);
	let failed = $state(false);
	let items = $state<LibraryViewItem[]>([]);
	let offlineLists = $state<WordList[]>([]);
	let busyId = $state<string | null>(null);

	async function load() {
		loading = true;
		failed = false;
		const store = getStore();
		try {
			items = await loadLibrary(store, fetch, basePath());
		} catch {
			failed = true;
			offlineLists = await loadInstalledLibraryLists(store).catch(() => []);
		} finally {
			loading = false;
		}
	}

	async function install(item: LibraryViewItem) {
		busyId = item.entry.id;
		try {
			const outcome = await installFromLibrary(getStore(), fetch, basePath(), item, Date.now());
			toasts.show(describeInstall(item.entry.title, outcome), 'success', 6000);
			items = await loadLibrary(getStore(), fetch, basePath());
		} catch (error) {
			toasts.show(error instanceof Error ? error.message : 'Toevoegen is niet gelukt.', 'error', 6000);
		} finally {
			busyId = null;
		}
	}

	onMount(load);
</script>

<svelte:head><title>Bibliotheek – Level Up</title></svelte:head>

<PageHeader title="Bibliotheek" subtitle="Kant-en-klare woordenlijsten. Eén tik en je kunt oefenen, ook offline." />

{#if loading}
	<p class="muted status" role="status">Bibliotheek laden…</p>
{:else if failed}
	<Card class="library-error" as="section">
		<div class="error-head">
			<CloudOff size={24} aria-hidden="true" />
			<h2>Bibliotheek niet beschikbaar</h2>
		</div>
		<p role="alert">
			Kon de bibliotheek niet laden. Ben je offline? Al toegevoegde lijsten blijven gewoon werken.
		</p>
		<div><Button variant="primary" onclick={load}>Opnieuw proberen</Button></div>
	</Card>

	{#if offlineLists.length > 0}
		<section class="stack" aria-labelledby="added-title">
			<h2 id="added-title">Al toegevoegd</h2>
			<ul role="list" class="grid">
				{#each offlineLists as list (list.id)}
					<Card as="li">
						<div class="card-body">
							<div class="texts">
								<h3>{list.title}</h3>
								<p class="small muted">{list.source} → {list.target}</p>
							</div>
							<Button variant="primary" href={practiceHref(list.id)}>
								Oefenen<span class="visually-hidden">: {list.title}</span>
							</Button>
						</div>
					</Card>
				{/each}
			</ul>
		</section>
	{/if}
{:else if items.length === 0}
	<EmptyState
		icon={Library}
		title="De bibliotheek is nog leeg"
		text="Er zijn nu geen meegeleverde lijsten. Je kunt wel een eigen lijst maken."
	>
		{#snippet action()}
			<Button variant="primary" href={newListHref()}>Eigen lijst maken</Button>
		{/snippet}
	</EmptyState>
{:else}
	<ul role="list" class="grid">
		{#each items as item (item.entry.id)}
			{@const entry = item.entry}
			<Card as="li" bevel={item.status === 'update-available'}>
				<div class="card-body">
					<div class="texts">
						<h2 class="card-title">{entry.title}</h2>
						<p class="small muted">
							{languageName(entry.source)} → {languageName(entry.target)} · {wordsLabel(entry.itemCount)}
						</p>
						{#if item.status === 'installed'}
							<p class="badge ok">✓ Toegevoegd</p>
						{:else if item.status === 'update-available'}
							<p class="badge update">↑ Update beschikbaar</p>
							<p class="small muted">Bijwerken kan veilig: je voortgang blijft behouden.</p>
						{/if}
					</div>
					<div class="actions">
						{#if item.status === 'not-installed'}
							<Button variant="primary" loading={busyId === entry.id} onclick={() => install(item)}>
								Toevoegen<span class="visually-hidden">: {entry.title}</span>
							</Button>
						{:else}
							{#if item.status === 'update-available'}
								<Button variant="secondary" loading={busyId === entry.id} onclick={() => install(item)}>
									Bijwerken<span class="visually-hidden">: {entry.title}</span>
								</Button>
							{/if}
							<Button variant="primary" href={practiceHref(entry.id)}>
								Oefenen<span class="visually-hidden">: {entry.title}</span>
							</Button>
						{/if}
					</div>
				</div>
			</Card>
		{/each}
	</ul>
{/if}

<Card as="section" class="library-own">
	<h2>Eigen lijst maken</h2>
	<p class="muted">
		Staat jouw woordenlijst er niet bij? Maak er zelf een, bijvoorbeeld voor je volgende toets.
		Je typt of plakt de woorden en kunt meteen oefenen.
	</p>
	<div>
		<Button variant="text" href={newListHref()}>
			Nieuwe lijst maken <ArrowRight size={20} aria-hidden="true" />
		</Button>
	</div>
</Card>

<style>
	.status {
		padding: var(--space-8) 0;
		text-align: center;
	}

	.grid {
		display: grid;
		gap: var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.stack {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-6);
	}

	.card-body {
		display: grid;
		gap: var(--space-4);
	}

	.texts {
		display: grid;
		gap: var(--space-1);
	}

	.card-title,
	h3 {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: var(--text-display-m);
		line-height: var(--leading-display-m);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.badge {
		width: fit-content;
		margin-top: var(--space-1);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-full);
		font-size: var(--text-small);
		font-weight: 600;
	}

	.badge.ok {
		background: var(--color-success-tint);
		color: var(--color-text);
	}

	.badge.update {
		background: var(--color-warning-tint);
		color: var(--color-text);
	}

	:global(.library-error) {
		display: grid;
		gap: var(--space-3);
		background: var(--color-error-tint);
	}

	.error-head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	:global(.library-own) {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-8);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	@media (min-width: 640px) {
		.card-body {
			grid-template-columns: 1fr auto;
			align-items: center;
		}
	}
</style>
