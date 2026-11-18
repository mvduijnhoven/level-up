<script lang="ts">
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		checked?: boolean;
		label: string;
		description?: string;
		disabled?: boolean;
		onchange?: (checked: boolean) => void;
	}

	let { checked = $bindable(false), label, description, disabled = false, onchange }: Props = $props();

	const descId = $props.id();
</script>

<label class="toggle" class:disabled>
	<span class="texts">
		<span class="label">{label}</span>
		{#if description}<span id={descId} class="small muted">{description}</span>{/if}
	</span>
	<input
		type="checkbox"
		role="switch"
		class="input"
		bind:checked
		{disabled}
		aria-describedby={description ? descId : undefined}
		onchange={(event) => onchange?.(event.currentTarget.checked)}
	/>
	<span class="track" aria-hidden="true">
		<span class="thumb"><Check size={16} strokeWidth={3} /></span>
	</span>
</label>

<style>
	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		min-height: var(--touch-target);
		padding-block: var(--space-2);
		cursor: pointer;
	}

	.toggle.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.texts {
		display: grid;
		min-width: 0;
	}

	.input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.track {
		position: relative;
		flex: none;
		width: 52px;
		height: 32px;
		border-radius: var(--radius-full);
		background: var(--color-surface);
		border: 2px solid var(--color-border-strong);
		transition:
			background-color var(--duration-fast),
			border-color var(--duration-fast);
	}

	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-full);
		background: var(--color-text-muted);
		color: transparent;
		transition:
			transform var(--duration-base) var(--ease-out),
			background-color var(--duration-fast);
	}

	.input:checked + .track {
		background: var(--color-primary);
		border-color: var(--color-primary);
	}

	.input:checked + .track .thumb {
		transform: translateX(20px);
		background: var(--color-on-primary);
		color: var(--color-primary);
	}

	.input:focus-visible + .track {
		outline: var(--focus-ring);
		outline-offset: var(--focus-offset);
	}
</style>