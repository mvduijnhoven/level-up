<script lang="ts" module>
	export interface ItemEditorValue {
		id?: string;
		term: string;
		translation: string;
		/** Ruwe tekst, gescheiden met | of ; */
		alternatives: string;
		example: string;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { Item } from '#lib/domain/types.ts';
	import Button from './Button.svelte';
	import TextField from './TextField.svelte';

	type EditorField = 'term' | 'translation';

	interface Props {
		/** Bestaand woord om te wijzigen; leeg voor een nieuw woord. */
		item?: Item;
		sourceLabel: string;
		targetLabel: string;
		/** Slaat op. Een fout met een veld (term of translation) wordt bij dat veld getoond, andere fouten bovenaan. */
		onsave: (value: ItemEditorValue) => Promise<void>;
		/** Sluit de editor (Annuleren/Klaar). */
		onclose: () => void;
	}

	let { item, sourceLabel, targetLabel, onsave, onclose }: Props = $props();

	const editing = $derived(item !== undefined);

	// De editor wordt per woord opnieuw aangemaakt (zie {#key}); alleen de beginwaarde telt
	// svelte-ignore state_referenced_locally
	let term = $state(item?.term ?? '');
	// svelte-ignore state_referenced_locally
	let translation = $state(item?.translation ?? '');
	// svelte-ignore state_referenced_locally
	let alternatives = $state(item?.alternatives.join(' | ') ?? '');
	// svelte-ignore state_referenced_locally
	let example = $state(item?.example ?? '');
	let errors = $state<Partial<Record<EditorField, string>>>({});
	let formError = $state('');
	let saving = $state(false);
	let termField = $state<TextField>();
	let added = $state(0);

	onMount(() => {
		// De dialoog zet de focus zelf na het openen; daarna pas het eerste veld focussen
		const timer = setTimeout(() => termField?.focus(), 50);
		return () => clearTimeout(timer);
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		errors = {};
		formError = '';
		saving = true;
		try {
			await onsave({
				id: item?.id,
				term,
				translation,
				alternatives,
				example
			});
			if (editing) {
				onclose();
			} else {
				added++;
				term = '';
				translation = '';
				alternatives = '';
				example = '';
				termField?.focus();
			}
		} catch (e) {
			const field = (e as { field?: string }).field;
			if (e instanceof Error && (field === 'term' || field === 'translation')) errors = { [field]: e.message };
			else formError = e instanceof Error ? e.message : 'Opslaan is niet gelukt. Probeer het opnieuw.';
		} finally {
			saving = false;
		}
	}
</script>

<form onsubmit={submit} novalidate>
	<TextField
		bind:this={termField}
		bind:value={term}
		label={`Woord (${sourceLabel})`}
		error={errors.term}
		required
		autocomplete="off"
	/>
	<TextField
		bind:value={translation}
		label={`Vertaling (${targetLabel})`}
		error={errors.translation}
		required
		autocomplete="off"
	/>
	<TextField
		bind:value={alternatives}
		label="Andere goede vertalingen"
		hint="Optioneel. Scheid ze met |"
		autocomplete="off"
	/>
	<TextField
		bind:value={example}
		label="Voorbeeldzin"
		hint={`Optioneel, in het ${targetLabel.toLowerCase()}`}
		autocomplete="off"
	/>

	{#if formError}<p class="form-error small" role="alert">{formError}</p>{/if}
	{#if !editing && added > 0}
		<p class="small added" role="status">{added} {added === 1 ? 'woord' : 'woorden'} toegevoegd. Typ gerust het volgende woord.</p>
	{/if}

	<div class="actions">
		<Button variant="text" onclick={onclose}>{editing ? 'Annuleren' : 'Klaar'}</Button>
		<Button variant="primary" type="submit" loading={saving}>{editing ? 'Opslaan' : 'Toevoegen'}</Button>
	</div>
</form>

<style>
	form {
		display: grid;
		gap: var(--space-4);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-3);
	}

	.form-error {
		color: var(--color-error);
	}

	.added {
		color: var(--color-success);
	}
</style>
