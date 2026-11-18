<script lang="ts">
	interface Props {
		remainingMs: number;
		totalMs: number;
		/** Onder deze waarde (ms) wisselt de kleur naar waarschuwing. */
		warnBelowMs?: number;
	}

	let { remainingMs, totalMs, warnBelowMs = 10_000 }: Props = $props();

	const fraction = $derived(totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0);
	const seconds = $derived(Math.max(0, Math.ceil(remainingMs / 1000)));
	const low = $derived(remainingMs < warnBelowMs);
</script>

<div class="timer" class:low>
	<div class="track" aria-hidden="true">
		<div class="fill" style:transform="scaleX({fraction})"></div>
	</div>
	<span class="time num" role="timer" aria-live="off">{seconds} s</span>
	<span class="sr-only" role="status">{low ? `Let op: nog ${seconds} seconden` : ''}</span>
</div>

<style>
	.timer {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		--bar: var(--color-energy);
	}

	.timer.low {
		--bar: var(--color-warning);
	}

	.track {
		flex: 1;
		height: 10px;
		border-radius: var(--radius-full);
		background: var(--color-surface-raised);
		overflow: hidden;
	}

	.fill {
		width: 100%;
		height: 100%;
		background: var(--bar);
		transform-origin: left center;
		transition:
			transform 250ms linear,
			background-color var(--duration-base);
	}

	.time {
		min-width: 3.5ch;
		text-align: right;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: var(--text-display-m);
		line-height: var(--leading-display-m);
		color: var(--bar);
	}
</style>