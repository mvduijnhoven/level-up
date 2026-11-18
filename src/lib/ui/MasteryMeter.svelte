<script lang="ts">
	import type { Mastery } from '#lib/domain/types.ts';
	import { MASTERY_BLOCKS, MASTERY_LABELS } from './mastery.ts';

	interface Props {
		level: Mastery;
		/** Toon het tekstlabel naast de blokjes. */
		showLabel?: boolean;
	}

	let { level, showLabel = true }: Props = $props();

	const filled = $derived(MASTERY_BLOCKS[level]);
</script>

<span class="meter {level}" role="img" aria-label="Beheersing: {MASTERY_LABELS[level]}, {filled} van 3">
	<span class="blocks" aria-hidden="true">
		{#each [0, 1, 2] as i (i)}
			<span class="block" class:on={i < filled}></span>
		{/each}
	</span>
	{#if showLabel}<span class="label small" aria-hidden="true">{MASTERY_LABELS[level]}</span>{/if}
</span>

<style>
	.meter {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--meter-color);
	}

	.new {
		--meter-color: var(--color-mastery-new);
	}
	.practiced {
		--meter-color: var(--color-mastery-practiced);
	}
	.known {
		--meter-color: var(--color-mastery-known);
	}
	.mastered {
		--meter-color: var(--color-mastery-mastered);
	}

	.blocks {
		display: inline-flex;
		gap: 3px;
	}

	.block {
		width: 14px;
		height: 10px;
		border-radius: 2px;
		border: 2px solid var(--meter-color);
	}

	.block.on {
		background: var(--meter-color);
	}

	.label {
		font-weight: 600;
	}
</style>