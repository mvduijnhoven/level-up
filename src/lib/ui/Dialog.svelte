<script lang="ts">
	import type { Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';

	interface Props {
		open?: boolean;
		title: string;
		/** Sluiten door buiten het venster te klikken. */
		dismissible?: boolean;
		onclose?: () => void;
		children: Snippet;
		/** Knoppen onderaan; de primaire actie staat het laatst. */
		actions?: Snippet;
	}

	let { open = $bindable(false), title, dismissible = true, onclose, children, actions }: Props = $props();

	const titleId = $props.id();
	let dialog = $state<HTMLDialogElement>();

	// Native <dialog> zorgt voor focus-trap, Escape en terugzetten van de focus
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function handleClose() {
		open = false;
		onclose?.();
	}

	function handleClick(event: MouseEvent) {
		if (dismissible && event.target === dialog) dialog?.close();
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} aria-labelledby={titleId} onclose={handleClose} onclick={handleClick}>
	<div class="panel">
		<header>
			<h2 id={titleId}>{title}</h2>
			<button type="button" class="close" aria-label="Sluiten" onclick={() => dialog?.close()}>
				<X size={24} aria-hidden="true" />
			</button>
		</header>
		<div class="content">{@render children()}</div>
		{#if actions}<footer>{@render actions()}</footer>{/if}
	</div>
</dialog>

<style>
	dialog {
		width: min(calc(100% - 2 * var(--space-4)), 440px);
		max-height: calc(100dvh - 2 * var(--space-4));
		padding: 0;
		border: 0;
		border-radius: var(--radius-m);
		background: var(--color-surface-raised);
		color: var(--color-text);
		overflow: hidden;
	}

	dialog[open] {
		animation: pop var(--duration-base) var(--ease-out);
	}

	dialog::backdrop {
		background: var(--color-scrim);
	}

	.panel {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-4) var(--space-4) var(--space-6);
		max-height: calc(100dvh - 2 * var(--space-4));
		overflow-y: auto;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	.close {
		flex: none;
		display: grid;
		place-items: center;
		width: var(--touch-target);
		height: var(--touch-target);
		margin-right: calc(-1 * var(--space-2));
		background: transparent;
		border: 0;
		border-radius: var(--radius-m);
		color: var(--color-text-muted);
	}

	.close:hover {
		color: var(--color-text);
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-3);
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
	}
</style>