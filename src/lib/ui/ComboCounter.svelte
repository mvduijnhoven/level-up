<script lang="ts">
	import Zap from '@lucide/svelte/icons/zap';

	interface Props {
		count: number;
		/** Vanaf deze stand krijgt de teller gloed. */
		glowFrom?: number;
	}

	let { count, glowFrom = 5 }: Props = $props();
</script>

{#if count >= 2}
	<div class="combo" class:glow={count >= glowFrom} role="img" aria-label="Combo van {count}">
		<Zap size={20} strokeWidth={2.5} aria-hidden="true" />
		{#key count}<span class="count num" aria-hidden="true">×{count}</span>{/key}
		<span class="label small" aria-hidden="true">combo</span>
	</div>
{/if}

<style>
	.combo {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--color-energy);
		font-family: var(--font-display);
		font-weight: 700;
	}

	.glow {
		filter: drop-shadow(0 0 6px var(--color-energy));
	}

	.count {
		display: inline-block;
		font-size: var(--text-display-m);
		line-height: var(--leading-display-m);
		animation: bump var(--duration-base) var(--ease-out);
	}

	.label {
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	@keyframes bump {
		40% {
			transform: scale(1.35);
		}
	}
</style>