<script lang="ts">
	import { tick } from 'svelte';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { getStore, languageName } from '#lib/data/index.ts';
	import { countMastery } from '#lib/domain/index.ts';
	import { parseWordList } from '#lib/domain/parse.ts';
	import type { Item, Mastery, WordList } from '#lib/domain/types.ts';
	import {
		deleteList, duplicateAsOwn, importFromText, MAX_TITLE_LENGTH, parseAlternatives, removeItem,
		saveItem, updateListMeta, validateListMeta, type ListMetaErrors
	} from '#lib/app/lists.ts';
	import { listHref, listsHref, practiceHref } from '#lib/app/lists-links.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import ImportPaste from '#lib/ui/ImportPaste.svelte';
	import ItemEditor, { type ItemEditorValue } from '#lib/ui/ItemEditor.svelte';
	import LanguageField from '#lib/ui/LanguageField.svelte';
	import MasteryBar from '#lib/ui/MasteryBar.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import TextField from '#lib/ui/TextField.svelte';
	import { toasts } from '#lib/ui/toast.svelte.ts';
	import Library from '@lucide/svelte/icons/library';
	import ListX from '@lucide/svelte/icons/list-x';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	const PAGE_SIZE = 50;
	const LANGUAGES = ['nl', 'fr', 'en', 'de', 'es', 'it', 'la', 'el'].map(languageName);

	let phase = $state<'loading' | 'ready' | 'missing' | 'error'>('loading');
	let list = $state<WordList>();
	let items = $state<Item[]>([]);
	let forward = $state<Record<Mastery, number>>({ new: 0, practiced: 0, known: 0, mastered: 0 });
	let backward = $state<Record<Mastery, number>>({ new: 0, practiced: 0, known: 0, mastered: 0 });

	let title = $state('');
	let source = $state('');
	let target = $state('');
	let metaErrors = $state<ListMetaErrors>({});
	let metaError = $state('');
	let savingMeta = $state(false);

	let query = $state('');
	let shown = $state(PAGE_SIZE);

	let editorOpen = $state(false);
	let editing = $state<Item>();
	let pasteOpen = $state(false);
	let pasteText = $state('');
	let pasteError = $state('');
	let importing = $state(false);
	let deleteItemTarget = $state<Item>();
	let deleteItemOpen = $state(false);
	let deleteListOpen = $state(false);
	let busy = $state(false);

	const isOwn = $derived(list?.origin === 'own');
	const metaDirty = $derived(
		list !== undefined &&
			(title.trim() !== list.title || source.trim() !== list.source || target.trim() !== list.target)
	);

	const sorted = $derived([...items].sort((a, b) => a.term.localeCompare(b.term, 'nl')));
	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (q === '') return sorted;
		return sorted.filter((item) =>
			[item.term, item.translation, ...item.alternatives, item.example ?? ''].some((text) =>
				text.toLowerCase().includes(q)
			)
		);
	});
	const visible = $derived(filtered.slice(0, shown));

	async function refresh(id: string): Promise<boolean> {
		const store = getStore();
		const found = await store.lists.get(id);
		if (!found) {
			list = undefined;
			return false;
		}
		const [loadedItems, fwd, bwd] = await Promise.all([
			store.items.byList(id),
			store.progress.byList(id, 'forward'),
			store.progress.byList(id, 'backward')
		]);
		list = found;
		items = loadedItems;
		forward = countMastery(loadedItems, fwd);
		backward = countMastery(loadedItems, bwd);
		return true;
	}

	function resetForm(found: WordList) {
		title = found.title;
		source = found.source;
		target = found.target;
		metaErrors = {};
		metaError = '';
	}

	async function load(id: string) {
		phase = 'loading';
		try {
			if (!(await refresh(id)) || !list) {
				phase = 'missing';
				return;
			}
			resetForm(list);
			phase = 'ready';
			if (list.origin === 'own' && page.url.searchParams.has('add')) {
				openAdd();
				const url = new URL(page.url.href);
				url.searchParams.delete('add');
				try {
					replaceState(url, page.state);
				} catch {
					// Zonder router (nog) is het adres laten staan onschadelijk
				}
			}
		} catch {
			phase = 'error';
		}
	}

	$effect(() => {
		const id = page.params.id;
		if (id) void load(id);
		else phase = 'missing';
	});

	function openAdd() {
		editing = undefined;
		editorOpen = true;
	}

	function openEdit(item: Item) {
		editing = item;
		editorOpen = true;
	}

	async function saveEditor(value: ItemEditorValue) {
		if (!list) return;
		await saveItem(
			getStore(),
			list.id,
			{
				id: value.id,
				term: value.term,
				translation: value.translation,
				alternatives: parseAlternatives(value.alternatives, value.translation),
				example: value.example
			},
			Date.now()
		);
		await refresh(list.id);
		if (value.id) toasts.show('Woord opgeslagen.', 'success');
	}

	function askDeleteItem(item: Item) {
		deleteItemTarget = item;
		deleteItemOpen = true;
	}

	async function confirmDeleteItem() {
		const item = deleteItemTarget;
		if (!list || !item || busy) return;
		busy = true;
		try {
			await removeItem(getStore(), list.id, item.id, Date.now());
			await refresh(list.id);
			deleteItemOpen = false;
			toasts.show('Woord verwijderd.', 'success');
		} catch (e) {
			toasts.show(e instanceof Error ? e.message : 'Verwijderen is niet gelukt.', 'error');
		} finally {
			busy = false;
		}
	}

	async function saveMeta(event: SubmitEvent) {
		event.preventDefault();
		if (!list || savingMeta) return;
		metaError = '';
		metaErrors = validateListMeta({ title, source, target });
		if (Object.keys(metaErrors).length > 0) {
			await tick();
			document.querySelector<HTMLElement>('.meta-form [aria-invalid="true"]')?.focus();
			return;
		}
		savingMeta = true;
		try {
			list = await updateListMeta(getStore(), list.id, { title, source, target }, Date.now());
			resetForm(list);
			toasts.show('Wijzigingen opgeslagen.', 'success');
		} catch (e) {
			metaError = e instanceof Error ? e.message : 'Opslaan is niet gelukt. Probeer het opnieuw.';
		} finally {
			savingMeta = false;
		}
	}

	async function submitPaste(event: SubmitEvent) {
		event.preventDefault();
		if (!list || importing) return;
		pasteError = '';
		if (parseWordList(pasteText).items.length === 0) {
			pasteError = 'Er zijn geen woorden herkend. Zet een tab, komma of =-teken tussen het woord en de vertaling.';
			return;
		}
		importing = true;
		try {
			const summary = await importFromText(getStore(), list.id, pasteText, Date.now());
			await refresh(list.id);
			let message = `${summary.added} ${summary.added === 1 ? 'woord' : 'woorden'} toegevoegd.`;
			if (summary.skipped > 0) message += ` ${summary.skipped} overgeslagen omdat ze al in de lijst staan.`;
			if (summary.errors.length > 0) message += ` ${summary.errors.length} regels niet gelezen.`;
			toasts.show(message, summary.added > 0 ? 'success' : 'warning');
			if (summary.errors.length === 0) {
				pasteText = '';
				pasteOpen = false;
			}
		} catch (e) {
			pasteError = e instanceof Error ? e.message : 'Toevoegen is niet gelukt. Probeer het opnieuw.';
		} finally {
			importing = false;
		}
	}

	async function copyAsOwn() {
		if (!list || busy) return;
		busy = true;
		try {
			const copy = await duplicateAsOwn(getStore(), list.id, Date.now());
			toasts.show('Je eigen kopie is klaar. Hier kun je alles aanpassen.', 'success');
			await goto(listHref(copy.id));
		} catch (e) {
			toasts.show(e instanceof Error ? e.message : 'Kopiëren is niet gelukt.', 'error');
		} finally {
			busy = false;
		}
	}

	async function confirmDeleteList() {
		if (!list || busy) return;
		busy = true;
		try {
			await deleteList(getStore(), list.id);
			deleteListOpen = false;
			toasts.show('Lijst verwijderd.', 'success');
			await goto(listsHref());
		} catch (e) {
			toasts.show(e instanceof Error ? e.message : 'Verwijderen is niet gelukt.', 'error');
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{list ? `${list.title} · ` : ''}Lijst beheren · Level Up</title>
</svelte:head>

{#if phase === 'loading'}
	<PageHeader title="Lijst" backHref={listsHref()} backLabel="Lijsten" />
	<p class="muted" role="status">Lijst laden…</p>
{:else if phase === 'error'}
	<PageHeader title="Lijst" backHref={listsHref()} backLabel="Lijsten" />
	<p class="error-text" role="alert">De lijst kon niet worden geladen. Ververs de pagina en probeer het opnieuw.</p>
{:else if phase === 'missing' || !list}
	<PageHeader title="Lijst" backHref={listsHref()} backLabel="Lijsten" />
	<EmptyState
		title="Deze lijst bestaat niet (meer)"
		text="Misschien is de lijst verwijderd, of klopt het adres niet."
		icon={ListX}
	>
		{#snippet action()}
			<Button variant="primary" href={listsHref()}>Terug naar je lijsten</Button>
		{/snippet}
	</EmptyState>
{:else}
	<PageHeader
		title={list.title}
		backHref={listsHref()}
		backLabel="Lijsten"
		subtitle={`${list.source} → ${list.target} · ${items.length} ${items.length === 1 ? 'woord' : 'woorden'} · ${isOwn ? 'Eigen lijst' : 'Bibliotheek'}`}
	/>

	<div class="stack">
		<div class="top-actions">
			<Button variant="primary" href={practiceHref(list.id)} disabled={items.length === 0}>Oefenen</Button>
			{#if items.length === 0}<p class="small muted">Voeg eerst woorden toe om te kunnen oefenen.</p>{/if}
		</div>

		<Card as="section" class="progress-card">
			<h2>Voortgang</h2>
			<div class="direction">
				<p class="dir-label"><strong>Heen:</strong> {list.source} → {list.target}</p>
				<MasteryBar counts={forward} label={`Beheersing heen, ${list.source} naar ${list.target}`} />
			</div>
			<div class="direction">
				<p class="dir-label"><strong>Terug:</strong> {list.target} → {list.source}</p>
				<MasteryBar counts={backward} label={`Beheersing terug, ${list.target} naar ${list.source}`} />
			</div>
		</Card>

		{#if !isOwn}
			<Card as="aside" raised class="library-note">
				<h2><Library size={20} aria-hidden="true" /> Lijst uit de bibliotheek</h2>
				<p>
					Deze lijst kun je oefenen, maar niet wijzigen. Wil je woorden aanpassen of toevoegen? Maak
					dan een eigen kopie. Je voortgang in deze lijst blijft hier staan; de kopie begint opnieuw.
				</p>
				<div>
					<Button variant="primary" loading={busy} onclick={copyAsOwn}>Kopie maken als eigen lijst</Button>
				</div>
			</Card>
		{/if}

		<section class="words" aria-labelledby="words-heading">
			<div class="words-head">
				<h2 id="words-heading">Woorden <span class="muted num">({items.length})</span></h2>
				{#if isOwn}
					<div class="words-actions">
						<Button variant="secondary" onclick={openAdd}>
							<Plus size={20} aria-hidden="true" /> Woord toevoegen
						</Button>
						<Button variant="secondary" onclick={() => (pasteOpen = !pasteOpen)} aria-expanded={pasteOpen}>
							<ClipboardPaste size={20} aria-hidden="true" /> Plakken
						</Button>
					</div>
				{/if}
			</div>

			{#if isOwn && pasteOpen}
				<Card as="div" raised>
					<form class="paste-form" onsubmit={submitPaste} novalidate>
						<ImportPaste bind:value={pasteText} label="Meer woorden plakken" error={pasteError} rows={6} />
						<div class="paste-actions">
							<Button variant="text" onclick={() => (pasteOpen = false)}>Annuleren</Button>
							<Button variant="primary" type="submit" loading={importing}>Woorden toevoegen</Button>
						</div>
					</form>
				</Card>
			{/if}

			{#if items.length === 0}
				<EmptyState
					title="Nog geen woorden"
					text={isOwn
						? 'Voeg je eerste woord toe, of plak een hele lijst in één keer.'
						: 'Deze lijst bevat geen woorden.'}
				>
					{#snippet action()}
						{#if isOwn}
							<Button variant="primary" onclick={openAdd}>
								<Plus size={20} aria-hidden="true" /> Woord toevoegen
							</Button>
						{/if}
					{/snippet}
				</EmptyState>
			{:else}
				{#if items.length > 8}
					<TextField
						type="search"
						bind:value={query}
						label="Zoeken in de lijst"
						placeholder="Zoek een woord of vertaling"
						autocomplete="off"
						oninput={() => (shown = PAGE_SIZE)}
					/>
				{/if}

				<p class="small muted" role="status">
					{#if query.trim() !== ''}
						{filtered.length} van {items.length} woorden
					{/if}
				</p>

				{#if filtered.length === 0}
					<p class="muted">Geen woorden gevonden voor “{query.trim()}”.</p>
				{:else}
					<ul class="items" role="list">
						{#each visible as item (item.id)}
							<li class="item">
								<div class="texts">
									<p class="term">{item.term}</p>
									<p class="translation">{item.translation}</p>
									{#if item.alternatives.length > 0}
										<p class="small muted">Ook goed: {item.alternatives.join(', ')}</p>
									{/if}
									{#if item.example}<p class="small muted example">{item.example}</p>{/if}
								</div>
								{#if isOwn}
									<div class="row-actions">
										<button type="button" class="icon-btn" aria-label={`Wijzig ${item.term}`} onclick={() => openEdit(item)}>
											<Pencil size={20} aria-hidden="true" />
										</button>
										<button type="button" class="icon-btn" aria-label={`Verwijder ${item.term}`} onclick={() => askDeleteItem(item)}>
											<Trash2 size={20} aria-hidden="true" />
										</button>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
					{#if filtered.length > visible.length}
						<div class="more">
							<Button variant="secondary" onclick={() => (shown += PAGE_SIZE)}>
								Meer tonen ({filtered.length - visible.length} te gaan)
							</Button>
						</div>
					{/if}
				{/if}
			{/if}
		</section>

		{#if isOwn}
			<Card as="section" class="meta-card">
				<h2>Gegevens van de lijst</h2>
				<form class="meta-form" onsubmit={saveMeta} novalidate>
					<TextField
						bind:value={title}
						label="Titel"
						maxlength={MAX_TITLE_LENGTH}
						error={metaErrors.title}
						required
						autocomplete="off"
					/>
					<div class="langs">
						<LanguageField
							bind:value={source}
							label="Brontaal"
							suggestions={LANGUAGES}
							error={metaErrors.source}
							required
						/>
						<LanguageField
							bind:value={target}
							label="Doeltaal"
							suggestions={LANGUAGES}
							error={metaErrors.target}
							required
						/>
					</div>
					{#if metaError}<p class="error-text" role="alert">{metaError}</p>{/if}
					<div>
						<Button variant="secondary" type="submit" loading={savingMeta} disabled={!metaDirty}>
							Wijzigingen opslaan
						</Button>
					</div>
				</form>
			</Card>
		{/if}

		<section class="danger-zone" aria-labelledby="danger-heading">
			<h2 id="danger-heading">Lijst verwijderen</h2>
			<p class="muted">Je verwijdert de lijst met alle woorden en je voortgang.</p>
			<div>
				<Button variant="secondary" class="danger" onclick={() => (deleteListOpen = true)}>
					<Trash2 size={20} aria-hidden="true" /> Lijst verwijderen
				</Button>
			</div>
		</section>
	</div>

	<Dialog bind:open={editorOpen} title={editing ? 'Woord wijzigen' : 'Woord toevoegen'}>
		{#if editorOpen}
			{#key editing?.id}
				<ItemEditor
					item={editing}
					sourceLabel={list.source}
					targetLabel={list.target}
					onsave={saveEditor}
					onclose={() => (editorOpen = false)}
				/>
			{/key}
		{/if}
	</Dialog>

	<Dialog bind:open={deleteItemOpen} title="Woord verwijderen?">
		<p>
			Je verwijdert <strong>{deleteItemTarget?.term}</strong> ({deleteItemTarget?.translation}) uit deze lijst.
			De voortgang van dit woord verdwijnt ook.
		</p>
		{#snippet actions()}
			<Button variant="text" onclick={() => (deleteItemOpen = false)}>Annuleren</Button>
			<Button variant="secondary" class="danger" loading={busy} onclick={confirmDeleteItem}>Verwijderen</Button>
		{/snippet}
	</Dialog>

	<Dialog bind:open={deleteListOpen} title="Lijst verwijderen?">
		<p>
			Je verwijdert <strong>{list.title}</strong> met alle {items.length} woorden. Ook je voortgang en
			scores in deze lijst verdwijnen. Dit kun je niet ongedaan maken.
		</p>
		{#snippet actions()}
			<Button variant="text" onclick={() => (deleteListOpen = false)}>Annuleren</Button>
			<Button variant="secondary" class="danger" loading={busy} onclick={confirmDeleteList}>
				Ja, verwijder de lijst
			</Button>
		{/snippet}
	</Dialog>
{/if}

<style>
	.stack {
		display: grid;
		gap: var(--space-6);
	}

	.top-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3);
	}

	.stack :global(.progress-card),
	.stack :global(.meta-card),
	.stack :global(.library-note) {
		display: grid;
		gap: var(--space-4);
	}

	.stack :global(.library-note h2) {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.direction {
		display: grid;
		gap: var(--space-2);
	}

	.meta-form {
		display: grid;
		gap: var(--space-4);
	}

	.langs {
		display: grid;
		gap: var(--space-4);
	}

	@media (min-width: 560px) {
		.langs {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.words {
		display: grid;
		gap: var(--space-3);
	}

	.words-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.words-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.paste-form {
		display: grid;
		gap: var(--space-4);
	}

	.paste-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-3);
	}

	.items {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-m);
		overflow: hidden;
	}

	.item {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
	}

	.item + .item {
		border-top: 1px solid var(--color-border);
	}

	.texts {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.term {
		font-weight: 600;
	}

	.example {
		font-style: italic;
	}

	.row-actions {
		flex: none;
		display: flex;
		margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0 0;
	}

	.icon-btn {
		display: grid;
		place-items: center;
		width: var(--touch-target);
		height: var(--touch-target);
		background: transparent;
		border: 0;
		border-radius: var(--radius-m);
		color: var(--color-text-muted);
	}

	.icon-btn:hover {
		color: var(--color-text);
		background: var(--color-surface-raised);
	}

	.more {
		display: flex;
		justify-content: center;
	}

	.danger-zone {
		display: grid;
		gap: var(--space-2);
		padding-top: var(--space-6);
		border-top: 1px solid var(--color-border);
	}

	:global(.btn.danger) {
		border-color: var(--color-error);
		color: var(--color-error);
	}

	.error-text {
		color: var(--color-error);
	}
</style>
