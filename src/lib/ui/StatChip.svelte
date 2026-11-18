<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';

	interface Props {
		icon?: LucideIcon;
		value: string | number;
		label: string;
		color?: 'energy' | 'xp' | 'primary' | 'success' | 'boss' | 'muted';
	}

	let { icon: Icon, value, label, color = 'xp' }: Props = $props();
</script>

<div class="chip {color}">
	{#if Icon}<Icon size={24} aria-hidden="true" />{/if}
	<div class="text">
		<span class="value num">{value}</span>
		<span class="label small">{label}</span>
	</div>
</div>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--touch-target);
		padding: var(--space-2) var(--space-4);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		color: var(--chip-color);
	}

	.energy {
		--chip-color: var(--color-energy);
	}
	.xp {
		--chip-color: var(--color-xp);
	}
	.primary {
		--chip-color: var(--color-primary-light);
	}
	.success {
		--chip-color: var(--color-success);
	}
	.boss {
		--chip-color: var(--color-boss);
	}
	.muted {
		--chip-color: var(--color-text-muted);
	}

	.text {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}

	.value {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: var(--text-display-m);
		line-height: var(--leading-display-m);
		color: var(--color-text);
	}

	.label {
		color: var(--color-text-muted);
	}
</style>