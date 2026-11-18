<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';

	interface Props {
		label: string;
		value?: string;
		suggestions: string[];
		hint?: string;
		error?: string;
		required?: boolean;
		maxlength?: number;
		onblur?: () => void;
	}

	let {
		label,
		value = $bindable(''),
		suggestions,
		hint,
		error,
		required = false,
		maxlength = 40,
		onblur
	}: Props = $props();

	const uid = $props.id();
	const hintId = `${uid}-hint`;
	const errorId = `${uid}-error`;
	const listId = `${uid}-list`;
	const describedBy = $derived([hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined);
</script>

<div class="field" class:invalid={!!error}>
	<label for={uid}>{label}{#if required}<span class="req" aria-hidden="true"> *</span>{/if}</label>
	{#if hint}<p id={hintId} class="small muted">{hint}</p>{/if}
	<input
		id={uid}
		type="text"
		list={listId}
		bind:value
		{required}
		{maxlength}
		autocomplete="off"
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		{onblur}
	/>
	<datalist id={listId}>
		{#each suggestions as suggestion (suggestion)}
			<option value={suggestion}></option>
		{/each}
	</datalist>
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

	input {
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

	input:focus-visible {
		border-color: var(--color-energy);
	}

	.invalid input {
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
