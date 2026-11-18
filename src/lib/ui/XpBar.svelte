<script lang="ts">
	import ProgressBar from './ProgressBar.svelte';

	interface Props {
		level: number;
		/** Voortgang binnen het huidige niveau, 0..1. */
		progress: number;
		/** Optionele XP-tekst, bijvoorbeeld "120 / 200 XP". */
		detail?: string;
	}

	let { level, progress, detail }: Props = $props();
</script>

<div class="xp-bar">
	<div class="level" aria-hidden="true">
		<span class="label-caps">Niveau</span>
		<span class="num">{level}</span>
	</div>
	<div class="bar">
		<ProgressBar
			value={progress}
			color="xp"
			label="Voortgang naar niveau {level + 1}"
			valueText={detail ?? `${Math.round(progress * 100)}%`}
		/>
		{#if detail}<span class="detail small muted num">{detail}</span>{/if}
	</div>
</div>

<style>
	.xp-bar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.level {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 56px;
		padding-inline: var(--space-1);
		color: var(--color-xp);
		line-height: 1;
	}

	.level .num {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: var(--text-display-l);
		line-height: var(--leading-display-l);
	}

	.bar {
		display: grid;
		gap: var(--space-1);
		flex: 1;
		min-width: 0;
	}
</style>