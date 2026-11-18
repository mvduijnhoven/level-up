<script lang="ts">
	import { applyUpdate, pwa } from '#lib/app/pwa.svelte.ts';

	let { hidden = false }: { hidden?: boolean } = $props();
</script>

{#if pwa.updateAvailable && !hidden}
	<div class="update-banner" role="status">
		<span class="message">Nieuwe versie beschikbaar</span>
		<button type="button" class="action" onclick={applyUpdate}>Nu bijwerken</button>
	</div>
{/if}

<style>
	.update-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface-raised);
		color: var(--color-text);
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-m);
	}

	.message {
		font-family: var(--font-text);
	}

	.action {
		min-height: 44px;
		padding: var(--space-2) var(--space-4);
		border: 0;
		border-radius: var(--radius-s);
		background: var(--color-primary);
		color: var(--color-text);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.action:focus-visible {
		outline: 3px solid var(--color-primary-light);
		outline-offset: 2px;
	}
</style>
