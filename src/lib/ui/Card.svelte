<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Afgeschuinde hoek rechtsboven (herkenningsteken; spaarzaam gebruiken). */
		bevel?: boolean;
		/** Lichtere tint voor zwevende of geselecteerde kaarten. */
		raised?: boolean;
		as?: 'div' | 'section' | 'article' | 'li' | 'aside';
		padded?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		bevel = false,
		raised = false,
		as = 'div',
		padded = true,
		class: className = '',
		children
	}: Props = $props();
</script>

<svelte:element this={as} class="card {className}" class:bevel class:raised class:padded>
	{@render children()}
</svelte:element>

<style>
	.card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-m);
		min-width: 0;
	}

	.padded {
		padding: var(--space-4);
	}

	.raised {
		background: var(--color-surface-raised);
	}

	/* De clip-path snijdt de rand bij de hoek weg; daarom geen rand bij de afgeschuinde variant */
	.bevel {
		border-color: transparent;
		border-radius: 0;
		background: var(--color-surface-raised);
		clip-path: polygon(0 0, calc(100% - var(--bevel)) 0, 100% var(--bevel), 100% 100%, 0 100%);
	}
</style>