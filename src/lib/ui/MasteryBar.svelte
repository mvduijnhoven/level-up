<script lang="ts">
	import type { Mastery } from '#lib/domain/types.ts';
	import { MASTERY_BLOCKS, MASTERY_LABELS, MASTERY_ORDER } from './mastery.ts';

	interface Props {
		counts: Record<Mastery, number>;
		/** Beschrijving voor schermlezers, bijvoorbeeld "Beheersing Frans hoofdstuk 3". */
		label?: string;
		showLegend?: boolean;
	}

	let { counts, label = 'Beheersing', showLegend = true }: Props = $props();

	const total = $derived(MASTERY_ORDER.reduce((sum, level) => sum + (counts[level] ?? 0), 0));
	const summary = $derived(
		`${label}: ` +
			MASTERY_ORDER.map((level) => `${counts[level] ?? 0} ${MASTERY_LABELS[level].toLowerCase()}`).join(', ')
	);
</script>

<div class="mastery-bar">
	<div class="bar" role="img" aria-label={summary}>
		{#each MASTERY_ORDER as level (level)}
			{#if counts[level] > 0}
				<span class="seg {level}" style:flex-grow={counts[level]}></span>
			{/if}
		{/each}
		{#if total === 0}<span class="seg empty"></span>{/if}
	</div>
	{#if showLegend}
		<ul class="legend small" role="list">
			{#each MASTERY_ORDER as level (level)}
				<li class="{level}">
					<span class="blocks" aria-hidden="true">
						{#each [0, 1, 2] as i (i)}
							<span class="block" class:on={i < MASTERY_BLOCKS[level]}></span>
						{/each}
					</span>
					<span>{MASTERY_LABELS[level]}</span>
					<strong class="num">{counts[level] ?? 0}</strong>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.mastery-bar {
		display: grid;
		gap: var(--space-2);
		width: 100%;
	}

	.bar {
		display: flex;
		gap: 2px;
		height: 12px;
		border-radius: var(--radius-full);
		overflow: hidden;
		background: var(--color-surface-raised);
	}

	.seg {
		flex-basis: 0;
		min-width: 4px;
	}

	.seg.empty {
		flex: 1;
	}

	.new {
		--c: var(--color-mastery-new);
	}
	.practiced {
		--c: var(--color-mastery-practiced);
	}
	.known {
		--c: var(--color-mastery-known);
	}
	.mastered {
		--c: var(--color-mastery-mastered);
	}

	.seg:not(.empty) {
		background: var(--c);
	}

	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		padding: 0;
		margin: 0;
		list-style: none;
		color: var(--color-text-muted);
	}

	.legend li {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.legend strong {
		color: var(--color-text);
		font-weight: 600;
	}

	.blocks {
		display: inline-flex;
		gap: 2px;
	}

	.block {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		border: 1.5px solid var(--c);
	}

	.block.on {
		background: var(--c);
	}
</style>