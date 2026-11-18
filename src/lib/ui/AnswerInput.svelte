<script lang="ts">
	import type { AnswerResult } from '#lib/domain/types.ts';

	interface Props {
		value?: string;
		/** Taalcode van het antwoord (voor toetsenbord en spraak), bijvoorbeeld "fr". */
		lang?: string;
		label?: string;
		placeholder?: string;
		specialChars?: string[];
		disabled?: boolean;
		/** Toont kort de reactie van het veld (groene flits, schud bij fout). */
		feedback?: AnswerResult | null;
		onsubmit?: (value: string) => void;
	}

	const FRENCH_CHARS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'ù', 'û', 'ü', 'œ'];

	let {
		value = $bindable(''),
		lang,
		label = 'Je antwoord',
		placeholder = 'Typ je antwoord',
		specialChars = FRENCH_CHARS,
		disabled = false,
		feedback = null,
		onsubmit
	}: Props = $props();

	const id = $props.id();
	let input = $state<HTMLInputElement>();

	export function focus() {
		input?.focus();
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (disabled) return;
		onsubmit?.(value);
	}

	// Voegt in op de cursorpositie; de focus blijft in het veld
	function insert(char: string) {
		if (!input || disabled) return;
		const start = input.selectionStart ?? value.length;
		const end = input.selectionEnd ?? start;
		input.setRangeText(char, start, end, 'end');
		value = input.value;
		input.focus();
	}
</script>

<form class="answer-input" onsubmit={submit} novalidate>
	<label class="sr-only" for={id}>{label}</label>
	<input
		bind:this={input}
		{id}
		class="field {feedback ?? ''}"
		type="text"
		bind:value
		{lang}
		{placeholder}
		{disabled}
		autocomplete="off"
		autocapitalize="off"
		autocorrect="off"
		spellcheck="false"
		enterkeyhint="done"
	/>
	{#if specialChars.length}
		<div class="chars" role="group" aria-label="Speciale tekens">
			{#each specialChars as char (char)}
				<button
					type="button"
					class="char"
					{lang}
					{disabled}
					aria-label="Voeg {char} in"
					onpointerdown={(event) => event.preventDefault()}
					onmousedown={(event) => event.preventDefault()}
					onclick={() => insert(char)}
				>
					{char}
				</button>
			{/each}
		</div>
	{/if}
</form>

<style>
	.answer-input {
		display: grid;
		gap: var(--space-3);
		width: 100%;
	}

	.field {
		width: 100%;
		min-height: var(--input-height);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		color: var(--color-text);
		border: 2px solid var(--color-border-strong);
		border-radius: var(--radius-m);
		font-family: var(--font-text);
		font-size: var(--text-answer);
		line-height: var(--leading-answer);
		transition:
			border-color var(--duration-fast),
			background-color var(--duration-fast);
	}

	.field::placeholder {
		color: var(--color-text-muted);
	}

	.field:focus-visible {
		border-color: var(--color-energy);
	}

	.field:disabled {
		opacity: 0.6;
	}

	.field.correct {
		border-color: var(--color-success);
		background: var(--color-success-tint);
	}

	.field.almost {
		border-color: var(--color-warning);
		background: var(--color-warning-tint);
	}

	.field.wrong {
		border-color: var(--color-error);
		background: var(--color-error-tint);
		animation: shake var(--duration-base) var(--ease-out);
	}

	.chars {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--touch-target), 1fr));
		gap: 2px;
	}

	.char {
		min-height: var(--touch-target);
		padding: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-s);
		font-family: var(--font-text);
		font-size: var(--text-answer);
		line-height: var(--leading-answer);
		color: var(--color-text);
		touch-action: manipulation;
		transition: transform var(--duration-fast);
	}

	.char:hover:not(:disabled) {
		background: var(--color-surface-raised);
	}

	.char:active:not(:disabled) {
		transform: translateY(2px);
	}

	.char:disabled {
		opacity: 0.4;
	}

	@keyframes shake {
		20%,
		60% {
			transform: translateX(-6px);
		}
		40%,
		80% {
			transform: translateX(6px);
		}
	}
</style>