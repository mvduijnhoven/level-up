<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import Button from './Button.svelte';

	interface Props {
		options: string[];
		onselect: (index: number) => void;
		/** Na het antwoord: gekozen en juiste optie (kleur + icoon + tekst). */
		revealed?: { selected: number | null; correct: number };
		disabled?: boolean;
		label?: string;
	}

	let { options, onselect, revealed, disabled = false, label = 'Kies het juiste antwoord' }: Props = $props();

	function choose(index: number) {
		if (disabled || revealed) return;
		onselect(index);
	}

	function stateOf(index: number): 'default' | 'correct' | 'wrong' {
		if (!revealed) return 'default';
		if (index === revealed.correct) return 'correct';
		if (index === revealed.selected) return 'wrong';
		return 'default';
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
		const index = Number(event.key) - 1;
		if (Number.isInteger(index) && index >= 0 && index < options.length && index < 9) {
			event.preventDefault();
			choose(index);
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="choices" role="group" aria-label={label}>
	{#each options as option, index (index)}
		{@const state = stateOf(index)}
		<Button
			variant="answer"
			{state}
			disabled={disabled && !revealed}
			aria-keyshortcuts={String(index + 1)}
			onclick={() => choose(index)}
		>
			<span class="key num" aria-hidden="true">{index + 1}</span>
			<span class="text">{option}</span>
			{#if state === 'correct'}
				<Check size={24} strokeWidth={3} aria-hidden="true" />
				<span class="sr-only">Goed antwoord</span>
			{:else if state === 'wrong'}
				<X size={24} strokeWidth={3} aria-hidden="true" />
				<span class="sr-only">Jouw keuze, niet goed</span>
			{/if}
		</Button>
	{/each}
</div>

<style>
	.choices {
		display: grid;
		gap: var(--space-3);
		width: 100%;
	}

	.key {
		flex: none;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--color-border-strong);
		border-radius: var(--radius-s);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: var(--text-small);
		color: var(--color-text-muted);
	}

	.text {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
</style>