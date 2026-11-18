<script lang="ts">
	import '#lib/styles/fonts.css';
	import '#lib/styles/tokens.css';
	import '#lib/styles/base.css';
	import favicon from '#lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Library from '@lucide/svelte/icons/library';
	import Settings from '@lucide/svelte/icons/settings';
	import type { LucideIcon } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { initApp } from '#lib/app/init.ts';
	import Toast from '#lib/ui/Toast.svelte';
	import UpdateBanner from '#lib/ui/UpdateBanner.svelte';
	import { uiSettings } from '#lib/ui/ui-settings.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Hrefs worden uit het basispad opgebouwd, want resolve() kent alleen routes die al bestaan
	const NAV_ITEMS: { path: string; label: string; icon: LucideIcon }[] = [
		{ path: '/', label: 'Oefenen', icon: Gamepad2 },
		{ path: '/lists', label: 'Lijsten', icon: ListChecks },
		{ path: '/library', label: 'Bibliotheek', icon: Library },
		{ path: '/settings', label: 'Instellingen', icon: Settings }
	];

	const home = resolve('/');
	const base = home.replace(/\/+$/, '');
	const path = $derived.by(() => {
		const raw = page.url.pathname;
		const stripped = base && raw.startsWith(base) ? raw.slice(base.length) : raw;
		return stripped.replace(/\/+$/, '') || '/';
	});
	const focusMode = $derived(path === '/practice' || path.startsWith('/practice/'));

	function isActive(itemPath: string): boolean {
		return itemPath === '/' ? path === '/' : path === itemPath || path.startsWith(`${itemPath}/`);
	}

	onMount(() => {
		void initApp();
	});

	$effect(() => {
		document.documentElement.classList.toggle('reduce-motion', uiSettings.reduceMotion);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip" href="#main">Naar de inhoud</a>

<div class="shell" class:focus-mode={focusMode}>
	{#if !focusMode}
		<nav class="nav" aria-label="Hoofdmenu">
			<a class="logo" href={home} aria-label="Level Up, naar Oefenen">LEVEL <span>UP</span></a>
			<ul role="list">
				{#each NAV_ITEMS as item (item.path)}
					{@const Icon = item.icon}
					{@const active = isActive(item.path)}
					<li>
						<a
							class="nav-link"
							class:active
							href={item.path === '/' ? home : `${base}${item.path}`}
							aria-current={active ? 'page' : undefined}
						>
							<Icon size={24} aria-hidden="true" />
							<span>{item.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	{/if}

	<div class="column">
		<div class="banner-slot">
			<UpdateBanner hidden={focusMode} />
		</div>
		<main id="main" class:narrow={focusMode}>
			{@render children()}
		</main>
	</div>
</div>

<Toast />

<style>
	.skip {
		position: fixed;
		z-index: var(--z-dialog);
		top: var(--space-2);
		left: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface-raised);
		border-radius: var(--radius-m);
		color: var(--color-text);
		transform: translateY(-200%);
	}

	.skip:focus {
		transform: none;
	}

	.shell {
		min-height: 100dvh;
	}

	.column {
		min-width: 0;
	}

	main {
		width: 100%;
		max-width: var(--content-wide);
		margin-inline: auto;
		padding: var(--space-4) var(--space-4) calc(var(--nav-height) + var(--space-6));
		padding-bottom: calc(var(--nav-height) + var(--space-6) + env(safe-area-inset-bottom));
	}

	.focus-mode main {
		padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
	}

	main.narrow {
		max-width: var(--content-narrow);
	}

	/* Navigatie: balk onderaan op telefoon */
	.nav {
		position: fixed;
		z-index: var(--z-nav);
		inset: auto 0 0 0;
		padding-bottom: env(safe-area-inset-bottom);
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
	}

	.nav ul {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.logo {
		display: none;
	}

	.nav-link {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		min-height: var(--nav-height);
		padding: var(--space-2) var(--space-1);
		color: var(--color-text-muted);
		font-family: var(--font-display);
		font-weight: 600;
		font-size: var(--text-small);
		line-height: var(--leading-small);
		text-decoration: none;
	}

	.nav-link:hover {
		color: var(--color-text);
	}

	.nav-link.active {
		color: var(--color-primary-light);
		background: var(--color-primary-tint);
	}

	.nav-link.active::before {
		content: '';
		position: absolute;
		inset: 0 0 auto 0;
		height: 3px;
		background: var(--color-primary-light);
	}

	/* Zijbalk vanaf desktop */
	@media (min-width: 1024px) {
		.shell:not(.focus-mode) {
			display: grid;
			grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
		}

		.nav {
			position: sticky;
			inset: 0 auto auto 0;
			align-self: start;
			height: 100dvh;
			padding: var(--space-6) var(--space-4);
			border-top: 0;
			border-right: 1px solid var(--color-border);
		}

		.logo {
			display: block;
			margin-bottom: var(--space-8);
			padding-inline: var(--space-3);
			font-family: var(--font-display);
			font-weight: 700;
			font-size: var(--text-display-l);
			line-height: var(--leading-display-l);
			letter-spacing: 0.04em;
			color: var(--color-text);
			text-decoration: none;
		}

		.logo span {
			color: var(--color-xp);
		}

		.nav ul {
			display: grid;
			grid-template-columns: 1fr;
			gap: var(--space-1);
		}

		.nav-link {
			flex-direction: row;
			justify-content: flex-start;
			gap: var(--space-3);
			min-height: var(--touch-target);
			padding: var(--space-2) var(--space-3);
			border-radius: var(--radius-m);
			font-size: var(--text-body);
			line-height: var(--leading-body);
		}

		.nav-link.active::before {
			inset: var(--space-2) auto var(--space-2) 0;
			width: 3px;
			height: auto;
			border-radius: var(--radius-full);
		}

		main {
			padding: var(--space-8) var(--space-6);
		}
	}
</style>