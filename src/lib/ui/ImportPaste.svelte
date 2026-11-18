<script lang="ts">
	import { parseWordList } from '#lib/domain/parse.ts';
	import TextField from './TextField.svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	interface Props {
		value?: string;
		label?: string;
		/** Foutmelding van de aanroeper, bijvoorbeeld als er niets herkend is. */
		error?: string;
		rows?: number;
	}

	let { value = $bindable(''), label = 'Woorden plakken', error, rows = 8 }: Props = $props();

	const SAMPLE_COUNT = 4;
	const ERROR_COUNT = 5;
	const DELIMITER_LABEL = { tab: 'een tab', comma: 'een komma', equals: 'een =-teken' } as const;

	const result = $derived(parseWordList(value));
	const hasText = $derived(value.trim() !== '');
	const count = $derived(result.items.length);
</script>

<div class="import">
	<TextField
		bind:value
		{label}
		{rows}
		{error}
		multiline
		placeholder={'chat\tkat\nchien = hond | brak\nla maison, het huis, La maison est grande.'}
		hint="Plak je lijst: één regel per woord. Scheid het woord en de vertaling met een tab, een komma of =. Meerdere goede vertalingen scheid je met |. Een voorbeeldzin kan als derde deel."
	/>

	<div class="preview" aria-live="polite">
		{#if hasText}
			<p class="status" class:ok={count > 0}>
				{#if count > 0}
					<CircleCheck size={20} aria-hidden="true" />
				{:else}
					<TriangleAlert size={20} aria-hidden="true" />
				{/if}
				<span>
					<strong class="num">{count}</strong>
					{count === 1 ? 'woord' : 'woorden'} herkend
					{#if result.delimiter}<span class="muted"> · gescheiden door {DELIMITER_LABEL[result.delimiter]}</span>{/if}
				</span>
			</p>

			{#if result.duplicates > 0}
				<p class="small muted">
					{result.duplicates} dubbele {result.duplicates === 1 ? 'regel wordt' : 'regels worden'} overgeslagen.
				</p>
			{/if}

			{#if count > 0}
				<ul class="sample" role="list" aria-label="Voorbeeld van de herkende woorden">
					{#each result.items.slice(0, SAMPLE_COUNT) as item, i (i)}
						<li>
							<span class="term">{item.term}</span>
							<span class="arrow" aria-hidden="true">→</span>
							<span class="translation">{[item.translation, ...item.alternatives].join(' | ')}</span>
						</li>
					{/each}
					{#if count > SAMPLE_COUNT}
						<li class="muted small">… en nog {count - SAMPLE_COUNT}</li>
					{/if}
				</ul>
			{/if}

			{#if result.errors.length > 0}
				<div class="errors">
					<p class="error-title">
						<TriangleAlert size={20} aria-hidden="true" />
						<span>
							{result.errors.length}
							{result.errors.length === 1 ? 'regel kan' : 'regels kunnen'} niet gelezen worden en
							{result.errors.length === 1 ? 'wordt' : 'worden'} overgeslagen
						</span>
					</p>
					<ul role="list" class="small">
						{#each result.errors.slice(0, ERROR_COUNT) as err (err.line)}
							<li><strong>Regel {err.line}:</strong> {err.message}</li>
						{/each}
						{#if result.errors.length > ERROR_COUNT}
							<li class="muted">… en nog {result.errors.length - ERROR_COUNT} regels</li>
						{/if}
					</ul>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.import {
		display: grid;
		gap: var(--space-3);
	}

	.preview {
		display: grid;
		gap: var(--space-2);
	}

	.status {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		color: var(--color-warning);
	}

	.status.ok {
		color: var(--color-success);
	}

	.status :global(svg) {
		flex: none;
		margin-top: 2px;
	}

	.status span {
		color: var(--color-text);
	}

	.sample {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: var(--space-3);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-m);
	}

	.sample li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		overflow-wrap: anywhere;
	}

	.term {
		font-weight: 600;
	}

	.arrow {
		color: var(--color-text-muted);
	}

	.errors {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--color-warning-tint);
		border: 1px solid var(--color-warning);
		border-radius: var(--radius-m);
	}

	.error-title {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		font-weight: 600;
	}

	.error-title :global(svg) {
		flex: none;
		margin-top: 2px;
		color: var(--color-warning);
	}

	.errors ul {
		display: grid;
		gap: var(--space-1);
		margin: 0;
	}
</style>
