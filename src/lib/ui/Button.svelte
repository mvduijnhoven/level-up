<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class'> {
		variant?: 'primary' | 'secondary' | 'text' | 'answer';
		/** Rendert een link in plaats van een knop. */
		href?: string;
		loading?: boolean;
		/** Volle breedte (antwoordknoppen zijn altijd volle breedte). */
		block?: boolean;
		/** Alleen voor variant `answer`: markering na het antwoord. */
		state?: 'default' | 'selected' | 'correct' | 'wrong';
		class?: string;
		children: Snippet;
	}

	let {
		variant = 'secondary',
		href,
		type = 'button',
		disabled = false,
		loading = false,
		block = false,
		state = 'default',
		class: className = '',
		onclick,
		children,
		...rest
	}: Props = $props();

	const inactive = $derived(disabled || loading);
	const full = $derived(block || variant === 'answer');

	function handleClick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		if (inactive) {
			event.preventDefault();
			return;
		}
		onclick?.(event);
	}
</script>

{#snippet control()}
	{#if href}
		<a
			{...rest as object}
			href={inactive ? undefined : href}
			class="btn v-{variant} {className}"
			class:block={full}
			data-state={state}
			aria-disabled={inactive || undefined}
			aria-busy={loading || undefined}
			onclick={handleClick as unknown as (event: MouseEvent) => void}
		>
			{@render content()}
		</a>
	{:else}
		<button
			{...rest}
			{type}
			class="btn v-{variant} {className}"
			class:block={full}
			data-state={state}
			disabled={disabled}
			aria-disabled={loading || undefined}
			aria-busy={loading || undefined}
			onclick={handleClick}
		>
			{@render content()}
		</button>
	{/if}
{/snippet}

{#snippet content()}
	{#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
	{@render children()}
{/snippet}

{#if variant === 'primary'}
	<span class="glow" class:block={full} class:off={inactive}>{@render control()}</span>
{:else}
	{@render control()}
{/if}

<style>
	.glow {
		display: inline-flex;
		filter: var(--glow-filter-primary);
	}

	.glow.off {
		filter: none;
	}

	.glow.block {
		display: flex;
		width: 100%;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--touch-target);
		min-width: var(--touch-target);
		padding: var(--space-2) var(--space-6);
		border: 2px solid transparent;
		border-radius: var(--radius-m);
		background: transparent;
		color: var(--color-text);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: var(--text-display-m);
		line-height: var(--leading-display-m);
		text-align: center;
		text-decoration: none;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		transition:
			transform var(--duration-fast) var(--ease-out),
			background-color var(--duration-fast),
			border-color var(--duration-fast),
			opacity var(--duration-fast);
	}

	.btn.block {
		display: flex;
		width: 100%;
	}

	.btn:active:not(:disabled):not([aria-disabled='true']) {
		transform: translateY(2px);
	}

	.btn:disabled,
	.btn[aria-disabled='true'] {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn[aria-busy='true'] {
		opacity: 0.8;
		cursor: progress;
	}

	/* Primair: afgeschuinde hoek rechtsboven; de gloed zit op de omhullende span */
	.v-primary {
		background: var(--color-primary);
		color: var(--color-on-primary);
		border-radius: 0;
		clip-path: polygon(0 0, calc(100% - var(--bevel)) 0, 100% var(--bevel), 100% 100%, 0 100%);
	}

	.v-primary:hover:not(:disabled):not([aria-disabled='true']) {
		background: color-mix(in srgb, var(--color-primary), var(--color-on-primary) 12%);
	}

	/* Zonder dit zou de clip-path de focusrand wegsnijden */
	.v-primary:focus-visible {
		clip-path: none;
		border-radius: var(--radius-m);
	}

	.v-secondary {
		border-color: var(--color-border-strong);
	}

	.v-secondary:hover:not(:disabled):not([aria-disabled='true']) {
		background: var(--color-surface);
	}

	.v-text {
		color: var(--color-primary-light);
		padding-inline: var(--space-4);
	}

	.v-text:hover:not(:disabled):not([aria-disabled='true']) {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.v-answer {
		justify-content: flex-start;
		min-height: 56px;
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		border-color: var(--color-border-strong);
		font-family: var(--font-text);
		font-weight: 500;
		font-size: var(--text-answer);
		line-height: var(--leading-answer);
		text-align: left;
	}

	.v-answer:hover:not(:disabled):not([aria-disabled='true']) {
		background: var(--color-surface-raised);
	}

	.v-answer[data-state='selected'] {
		border-color: var(--color-primary-light);
		background: var(--color-primary-tint);
	}

	.v-answer[data-state='correct'] {
		border-color: var(--color-success);
		background: var(--color-success-tint);
	}

	.v-answer[data-state='wrong'] {
		border-color: var(--color-error);
		background: var(--color-error-tint);
	}

	.spinner {
		flex: none;
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: var(--radius-full);
		animation: spin 800ms linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
