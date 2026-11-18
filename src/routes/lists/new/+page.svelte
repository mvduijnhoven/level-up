<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { getStore, languageName } from '#lib/data/index.ts';
	import { parseWordList } from '#lib/domain/parse.ts';
	import {
		createList, deleteList, importFromText, MAX_TITLE_LENGTH, validateListMeta, type ListMetaErrors
	} from '#lib/app/lists.ts';
	import { listHref, listsHref } from '#lib/app/lists-links.ts';
	import Button from '#lib/ui/Button.svelte';
	import ImportPaste from '#lib/ui/ImportPaste.svelte';
	import LanguageField from '#lib/ui/LanguageField.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import TextField from '#lib/ui/TextField.svelte';
	import { toasts } from '#lib/ui/toast.svelte.ts';

	const LANGUAGES = ['nl', 'fr', 'en', 'de', 'es', 'it', 'la', 'el'].map(languageName);

	let title = $state('');
	let source = $state('');
	let target = $state('');
	let text = $state('');
	let errors = $state<ListMetaErrors>({});
	let pasteError = $state('');
	let formError = $state('');
	let saving = $state<'' | 'done' | 'add'>('');

	async function focusFirstInvalid() {
		await tick();
		document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	}

	async function save(next: 'done' | 'add') {
		if (saving) return;
		formError = '';
		pasteError = '';
		errors = validateListMeta({ title, source, target });
		if (Object.keys(errors).length > 0) return focusFirstInvalid();

		const hasText = text.trim() !== '';
		if (hasText && parseWordList(text).items.length === 0) {
			pasteError = 'Er zijn geen woorden herkend. Zet een tab, komma of =-teken tussen het woord en de vertaling, of maak het veld leeg.';
						return focusFirstInvalid();
		}

		saving = next;
		const store = getStore();
		const now = Date.now();
		let createdId: string | undefined;
		try {
			const list = await createList(store, { title, source, target }, now);
			createdId = list.id;
			let message = 'Lijst gemaakt.';
			if (hasText) {
				const summary = await importFromText(store, list.id, text, now);
				message = `Lijst gemaakt met ${summary.added} ${summary.added === 1 ? 'woord' : 'woorden'}.`;
				const left = summary.errors.length;
				if (left > 0) message += ` ${left} ${left === 1 ? 'regel' : 'regels'} overgeslagen.`;
			}
			toasts.show(message, 'success');
			await goto(next === 'add' ? `${listHref(list.id)}?add=1` : listHref(list.id));
		} catch (e) {
			if (createdId) await deleteList(store, createdId).catch(() => {});
			formError = e instanceof Error ? e.message : 'Opslaan is niet gelukt. Probeer het opnieuw.';
			saving = '';
		}
	}
</script>

<svelte:head>
	<title>Nieuwe lijst · Level Up</title>
</svelte:head>

<PageHeader title="Nieuwe lijst" backHref={listsHref()} backLabel="Lijsten" />

<form
	novalidate
	onsubmit={(event) => {
		event.preventDefault();
		void save('done');
	}}
>
	<section class="block" aria-labelledby="meta-title">
		<h2 id="meta-title">Waar gaat je lijst over?</h2>
		<TextField
			bind:value={title}
			label="Titel"
			placeholder="Bijvoorbeeld: Frans hoofdstuk 3"
			maxlength={MAX_TITLE_LENGTH}
			error={errors.title}
			required
			autocomplete="off"
		/>
		<div class="langs">
			<LanguageField
				bind:value={source}
				label="Brontaal"
				hint="De taal van de woorden die je ziet"
				suggestions={LANGUAGES}
				error={errors.source}
				required
			/>
			<LanguageField
				bind:value={target}
				label="Doeltaal"
				hint="De taal die je wilt leren"
				suggestions={LANGUAGES}
				error={errors.target}
				required
			/>
		</div>
	</section>

	<section class="block" aria-labelledby="words-title">
		<h2 id="words-title">Woorden toevoegen</h2>
		<p class="muted">
			Plak hier je woorden, dan zijn ze meteen klaar. Je kunt ook eerst de lijst maken en daarna de
			woorden één voor één toevoegen.
		</p>
		<ImportPaste bind:value={text} label="Plak je woorden (optioneel)" error={pasteError} />
	</section>

	{#if formError}<p class="form-error" role="alert">{formError}</p>{/if}

	<div class="actions">
		<Button variant="primary" type="submit" loading={saving === 'done'} disabled={saving === 'add'}>
			Lijst maken
		</Button>
		<Button variant="secondary" loading={saving === 'add'} disabled={saving === 'done'} onclick={() => save('add')}>
			Maken en woorden toevoegen
		</Button>
	</div>
</form>

<style>
	form {
		display: grid;
		gap: var(--space-8);
		max-width: 640px;
	}

	.block {
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

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.form-error {
		color: var(--color-error);
	}
</style>
