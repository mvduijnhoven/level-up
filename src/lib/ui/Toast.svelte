<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Info from '@lucide/svelte/icons/info';
	import X from '@lucide/svelte/icons/x';
	import type { LucideIcon } from '@lucide/svelte';
	import { toasts, type ToastKind } from './toast.svelte.ts';

	const ICONS: Record<ToastKind, LucideIcon> = {
		info: Info,
		success: Check,
		warning: CircleAlert,
		error: X
	};
</script>

<!-- Het live-gebied staat altijd in de DOM, zodat nieuwe meldingen worden voorgelezen -->
<div class="toasts" role="region" aria-label="Meldingen" aria-live="polite">
	{#each toasts.items as toast (toast.id)}
		{@const Icon = ICONS[toast.kind]}
		<div class="toast {toast.kind}">
			<span class="icon" aria-hidden="true"><Icon size={20} strokeWidth={3} /></span>
			<p class="message">{toast.message}</p>
			<button type="button" class="close" aria-label="Melding sluiten" onclick={() => toasts.dismiss(toast.id)}>
				<X size={20} aria-hidden="true" />
			</button>
		</div>
	{/each}
</div>

<style>
	.toasts {
		position: fixed;
		z-index: var(--z-toast);
		inset-inline: 0;
		top: max(var(--space-4), env(safe-area-inset-top));
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		padding-inline: var(--space-4);
		pointer-events: none;
	}

	.toast {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: min(100%, 420px);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		background: var(--color-surface-raised);
		border-left: 4px solid var(--accent);
		border-radius: var(--radius-m);
		pointer-events: auto;
		animation: drop-in var(--duration-base) var(--ease-out);
	}

	.info {
		--accent: var(--color-energy);
	}
	.success {
		--accent: var(--color-success);
	}
	.warning {
		--accent: var(--color-warning);
	}
	.error {
		--accent: var(--color-error);
	}

	.icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--color-ink);
	}

	.message {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.close {
		flex: none;
		display: grid;
		place-items: center;
		width: var(--touch-target);
		height: var(--touch-target);
		background: transparent;
		border: 0;
		border-radius: var(--radius-m);
		color: var(--color-text-muted);
	}

	.close:hover {
		color: var(--color-text);
	}

	@keyframes drop-in {
		from {
			opacity: 0;
			transform: translateY(-16px);
		}
	}
</style>