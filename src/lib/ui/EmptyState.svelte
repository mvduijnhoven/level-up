<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LucideIcon } from '@lucide/svelte';

	interface Props {
		title: string;
		text?: string;
		icon?: LucideIcon;
		/** Eén duidelijke actie, bijvoorbeeld een Button. */
		action?: Snippet;
	}

	let { title, text, icon: Icon, action }: Props = $props();
</script>

<div class="empty">
	{#if Icon}
		<span class="icon" aria-hidden="true"><Icon size={40} strokeWidth={1.75} /></span>
	{/if}
	<h2>{title}</h2>
	{#if text}<p class="muted">{text}</p>{/if}
	{#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
	.empty {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		padding: var(--space-8) var(--space-4);
		text-align: center;
		max-width: 420px;
		margin-inline: auto;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 80px;
		height: 80px;
		border-radius: var(--radius-full);
		background: var(--color-surface-raised);
		color: var(--color-primary-light);
	}

	.action {
		margin-top: var(--space-3);
	}
</style>