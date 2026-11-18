<script lang="ts">
	interface Props {
		/** 0..1 */
		value: number;
		color?: 'primary' | 'energy' | 'xp' | 'success' | 'warning' | 'boss';
		/** Toegankelijke naam, ook zichtbaar als `showLabel`. */
		label: string;
		showLabel?: boolean;
		size?: 'thin' | 'normal';
		/** Alternatieve tekst voor schermlezers, bijvoorbeeld "3 van 10 vragen". */
		valueText?: string;
	}

	let {
		value,
		color = 'primary',
		label,
		showLabel = false,
		size = 'normal',
		valueText
	}: Props = $props();

	const clamped = $derived(Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0)));
	const percent = $derived(Math.round(clamped * 100));
</script>

<div class="wrap">
	{#if showLabel}
		<div class="head small muted"><span>{label}</span><span class="num">{percent}%</span></div>
	{/if}
	<div
		class="track {size}"
		role="progressbar"
		aria-label={label}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={percent}
		aria-valuetext={valueText}
	>
		<div class="fill {color}" style:transform="scaleX({clamped})"></div>
	</div>
</div>

<style>
	.wrap {
		display: grid;
		gap: var(--space-1);
		width: 100%;
	}

	.head {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.track {
		overflow: hidden;
		border-radius: var(--radius-full);
		background: var(--color-surface-raised);
		height: 12px;
	}

	.track.thin {
		height: 6px;
	}

	.fill {
		height: 100%;
		width: 100%;
		border-radius: inherit;
		transform-origin: left center;
		transition: transform var(--duration-slow) var(--ease-out);
	}

	.primary {
		background: var(--color-primary-light);
	}
	.energy {
		background: var(--color-energy);
	}
	.xp {
		background: var(--color-xp);
	}
	.success {
		background: var(--color-success);
	}
	.warning {
		background: var(--color-warning);
	}
	.boss {
		background: var(--color-boss);
	}
</style>