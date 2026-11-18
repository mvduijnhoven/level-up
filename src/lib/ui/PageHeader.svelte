<script lang="ts">
	import type { Snippet } from 'svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';

	interface Props {
		title: string;
		/** Toont een terug-link naar deze URL (gebruik `resolve()` of `base`). */
		backHref?: string;
		backLabel?: string;
		subtitle?: string;
		action?: Snippet;
	}

	let { title, backHref, backLabel = 'Terug', subtitle, action }: Props = $props();
</script>

<header class="page-header">
	{#if backHref}
		<a class="back" href={backHref}>
			<ChevronLeft size={20} aria-hidden="true" />
			<span>{backLabel}</span>
		</a>
	{/if}
	<div class="row">
		<div class="titles">
			<h1>{title}</h1>
			{#if subtitle}<p class="muted">{subtitle}</p>{/if}
		</div>
		{#if action}<div class="action">{@render action()}</div>{/if}
	</div>
</header>

<style>
	.page-header {
		display: grid;
		gap: var(--space-1);
		margin-bottom: var(--space-4);
	}

	.back {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--touch-target);
		width: fit-content;
		padding-right: var(--space-3);
		color: var(--color-primary-light);
		font-weight: 600;
		text-decoration: none;
	}

	.back:hover {
		text-decoration: underline;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.titles {
		min-width: 0;
	}

	h1 {
		overflow-wrap: anywhere;
	}

	.action {
		flex: none;
	}
</style>