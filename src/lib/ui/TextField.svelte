<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props {
		label: string;
		value?: string;
		hint?: string;
		error?: string;
		type?: HTMLInputAttributes['type'];
		multiline?: boolean;
		rows?: number;
		placeholder?: string;
		name?: string;
		required?: boolean;
		disabled?: boolean;
		maxlength?: number;
		lang?: string;
		autocomplete?: HTMLInputAttributes['autocomplete'];
		inputmode?: HTMLInputAttributes['inputmode'];
		oninput?: (value: string) => void;
		onblur?: () => void;
	}

	let {
		label,
		value = $bindable(''),
		hint,
		error,
		type = 'text',
		multiline = false,
		rows = 4,
		placeholder,
		name,
		required = false,
		disabled = false,
		maxlength,
		lang,
		autocomplete,
		inputmode,
		oninput,
		onblur
	}: Props = $props();

	const uid = $props.id();
	const hintId = `${uid}-hint`;
	const errorId = `${uid}-error`;
	const describedBy = $derived([hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined);

	let control = $state<HTMLInputElement | HTMLTextAreaElement>();

	export function focus() {
		control?.focus();
	}
</script>

<div class="field" class:invalid={!!error}>
	<label for={uid}>{label}{#if required}<span class="req" aria-hidden="true"> *</span>{/if}</label>
	{#if hint}<p id={hintId} class="small muted">{hint}</p>{/if}
	{#if multiline}
		<textarea
			bind:this={control}
			id={uid}
			bind:value
			{rows}
			{placeholder}
			{name}
			{required}
			{disabled}
			{maxlength}
			{lang}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			oninput={() => oninput?.(value)}
			{onblur}
		></textarea>
	{:else}
		<input
			bind:this={control}
			id={uid}
			{type}
			bind:value
			{placeholder}
			{name}
			{required}
			{disabled}
			{maxlength}
			{lang}
			{autocomplete}
			{inputmode}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={describedBy}
			oninput={() => oninput?.(value)}
			{onblur}
		/>
	{/if}
	{#if error}
		<p id={errorId} class="error small">
			<CircleAlert size={16} aria-hidden="true" />
			<span>{error}</span>
		</p>
	{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--space-1);
	}

	label {
		font-weight: 600;
	}

	.req {
		color: var(--color-text-muted);
	}

	input,
	textarea {
		width: 100%;
		min-height: var(--touch-target);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		color: var(--color-text);
		border: 2px solid var(--color-border-strong);
		border-radius: var(--radius-m);
		font-family: var(--font-text);
		font-size: var(--text-body);
		line-height: var(--leading-body);
		transition: border-color var(--duration-fast);
	}

	textarea {
		resize: vertical;
	}

	input::placeholder,
	textarea::placeholder {
		color: var(--color-text-muted);
	}

	input:focus-visible,
	textarea:focus-visible {
		border-color: var(--color-energy);
	}

	input:disabled,
	textarea:disabled {
		opacity: 0.4;
	}

	.invalid input,
	.invalid textarea {
		border-color: var(--color-error);
	}

	.error {
		display: flex;
		align-items: flex-start;
		gap: var(--space-1);
		color: var(--color-error);
	}

	.error :global(svg) {
		flex: none;
		margin-top: 2px;
	}
</style>