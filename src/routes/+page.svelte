<script lang="ts">
	import { onMount } from 'svelte';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Library from '@lucide/svelte/icons/library';
	import Play from '@lucide/svelte/icons/play';
	import X from '@lucide/svelte/icons/x';
	import { getStore } from '#lib/data/index.ts';
	import { DAY_MS, type Direction } from '#lib/domain/index.ts';
	import { href } from '#lib/app/links.ts';
	import {
		getListOverviews, getProfileSummary, type ListOverview, type ProfileSummary
	} from '#lib/app/stats.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import MasteryBar from '#lib/ui/MasteryBar.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import WeekDots from '#lib/ui/WeekDots.svelte';
	import XpBar from '#lib/ui/XpBar.svelte';

	const WELCOME_KEY = 'level-up:welcome-dismissed';
	const EXPORT_REMINDER_KEY = 'level-up:export-reminder-dismissed';
	const EXPORT_REMINDER_AFTER_DAYS = 14;
	const EXPORT_REMINDER_SNOOZE_DAYS = 7;
	const WELCOME_MAX_AGE_DAYS = 7;

	let loading = $state(true);
	let failed = $state(false);
	let summary = $state<ProfileSummary>();
	let overviews = $state<ListOverview[]>([]);
	let now = $state(0);
	let welcomeDismissed = $state(true);
	let exportReminderSnoozedAt = $state<number | null>(null);

	function readStorage(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	function writeStorage(key: string, value: string): void {
		try {
			localStorage.setItem(key, value);
		} catch {
			// Zonder localStorage verdwijnt de melding alleen voor deze sessie.
		}
	}

	async function load() {
		loading = true;
		failed = false;
		try {
			const store = getStore();
			const at = Date.now();
			const [s, o] = await Promise.all([getProfileSummary(store, at), getListOverviews(store, at)]);
			now = at;
			summary = s;
			overviews = o;
			welcomeDismissed = readStorage(WELCOME_KEY) !== null;
			const snoozed = Number(readStorage(EXPORT_REMINDER_KEY));
			exportReminderSnoozedAt = Number.isFinite(snoozed) && snoozed > 0 ? snoozed : null;
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}

	onMount(load);

	const hasProgress = $derived(
		!!summary && (summary.profile.xp > 0 || overviews.some((o) => o.lastPracticedAt !== null))
	);
	const showWelcome = $derived(
		!!summary &&
			!welcomeDismissed &&
			!hasProgress &&
			now - summary.profile.createdAt < WELCOME_MAX_AGE_DAYS * DAY_MS
	);
	const showExportReminder = $derived.by(() => {
		if (!summary || !hasProgress) return false;
		const last = summary.profile.lastExportAt ?? summary.profile.createdAt;
		if (now - last <= EXPORT_REMINDER_AFTER_DAYS * DAY_MS) return false;
		return (
			exportReminderSnoozedAt === null ||
			now - exportReminderSnoozedAt > EXPORT_REMINDER_SNOOZE_DAYS * DAY_MS
		);
	});

	const next = $derived(overviews[0]);

	function dismissWelcome() {
		welcomeDismissed = true;
		writeStorage(WELCOME_KEY, String(Date.now()));
	}

	function snoozeExportReminder() {
		exportReminderSnoozedAt = Date.now();
		writeStorage(EXPORT_REMINDER_KEY, String(exportReminderSnoozedAt));
	}

	function plural(n: number, one: string, many: string): string {
		return `${n} ${n === 1 ? one : many}`;
	}

	const weekLabel = $derived.by(() => {
		if (!summary) return '';
		const { activeCount, goalDays, reached } = summary.week;
		const text = `${activeCount} van ${plural(goalDays, 'dag', 'dagen')} deze week`;
		return reached ? `${text} – weekdoel gehaald!` : text;
	});

	const DIRECTION_ROWS: { direction: Direction; label: string }[] = [
		{ direction: 'forward', label: 'Heen' },
		{ direction: 'backward', label: 'Terug' }
	];
</script>

<svelte:head>
	<title>Level Up</title>
</svelte:head>

<PageHeader title="Level Up" subtitle="Elke dag een beetje, dan kom je het verst." />

{#if loading}
	<div class="stack" aria-busy="true" aria-label="Bezig met laden">
		<div class="skeleton" style:height="148px"></div>
		<div class="skeleton" style:height="56px"></div>
		<div class="grid">
			<div class="skeleton" style:height="236px"></div>
			<div class="skeleton" style:height="236px"></div>
		</div>
	</div>
{:else if failed || !summary}
	<EmptyState
		title="Het laden is niet gelukt"
		text="Je gegevens konden niet worden gelezen. Probeer het nog eens."
	>
		{#snippet action()}
			<Button variant="primary" onclick={load}>Opnieuw proberen</Button>
		{/snippet}
	</EmptyState>
{:else}
	<div class="stack">
		{#if showWelcome}
			<aside class="notice" aria-label="Welkom">
				<div class="notice-text">
					<strong>Welkom bij Level Up!</strong>
					<p class="small">
						Je voortgang staat alleen in deze browser. Maak in
						<a href={href('/settings')}>Instellingen</a> een back-up, dan raak je niets kwijt.
					</p>
				</div>
				<button type="button" class="close" onclick={dismissWelcome} aria-label="Melding sluiten">
					<X size={20} aria-hidden="true" />
				</button>
			</aside>
		{:else if showExportReminder}
			<aside class="notice" aria-label="Herinnering back-up">
				<div class="notice-text">
					<strong>Tijd voor een back-up?</strong>
					<p class="small">
						Je hebt al een tijdje geen back-up gemaakt. Doe dat in
						<a href={href('/settings')}>Instellingen</a>, zodat je voortgang veilig blijft.
					</p>
				</div>
				<button type="button" class="close" onclick={snoozeExportReminder} aria-label="Herinnering sluiten">
					<X size={20} aria-hidden="true" />
				</button>
			</aside>
		{/if}

		<Card as="section">
			<div class="progress-card">
				<XpBar
					level={summary.level.level}
					progress={summary.level.progress}
					detail="{summary.level.xpIntoLevel} / {summary.level.xpForNextLevel} XP"
				/>
				<WeekDots days={summary.week.days} label={weekLabel} />
			</div>
		</Card>

		{#if next}
			<div class="primary-action">
				<Button variant="primary" block href={href('/practice/' + next.list.id)}>
					<Play size={22} aria-hidden="true" />
					{hasProgress ? 'Verder oefenen' : 'Begin met oefenen'}
				</Button>
				<p class="small muted">
					{next.list.title}{#if next.totalDue > 0}{' · '}{next.totalDue} te herhalen{/if}
				</p>
			</div>

			<section aria-labelledby="lists-heading">
				<h2 id="lists-heading" class="section-title">Jouw lijsten</h2>
				<ul class="grid" role="list">
					{#each overviews as o (o.list.id)}
						<Card as="li" bevel>
							<div class="list-card">
								<div class="list-head">
									<h3 class="list-title">{o.list.title}</h3>
									<p class="small muted">
										{o.list.source} → {o.list.target} · {plural(o.itemCount, 'woord', 'woorden')}
									</p>
								</div>
								<div class="rows">
									{#each DIRECTION_ROWS as row (row.direction)}
										{@const d = o.perDirection[row.direction]}
										<div class="row">
											<span class="row-label small">{row.label}</span>
											<MasteryBar
												counts={d.counts}
												showLegend={false}
												label="Beheersing {row.label.toLowerCase()}"
											/>
											<span class="row-count small muted num">
												{d.counts.mastered}/{o.itemCount} beheerst
											</span>
										</div>
									{/each}
								</div>
								<p class="small status">
									<span class:due={o.totalDue > 0}>{o.totalDue} te herhalen</span>
									<span class="muted"> · {o.totalNew} nieuw</span>
								</p>
								<Button
									variant="secondary"
									block
									href={href('/practice/' + o.list.id)}
									aria-label="Oefenen: {o.list.title}"
								>
									Oefenen
								</Button>
							</div>
						</Card>
					{/each}
				</ul>
			</section>
		{:else}
			<EmptyState
				icon={BookOpen}
				title="Nog geen woordenlijsten"
				text="Voeg een lijst uit de bibliotheek toe of maak je eigen lijst. Daarna kun je meteen oefenen."
			>
				{#snippet action()}
					<div class="empty-actions">
						<Button variant="primary" block href={href('/library')}>
							<Library size={22} aria-hidden="true" />
							Bibliotheek bekijken
						</Button>
						<Button variant="secondary" block href={href('/lists/new')}>Eigen lijst maken</Button>
					</div>
				{/snippet}
			</EmptyState>
		{/if}
	</div>
{/if}

<style>
	.stack {
		display: grid;
		gap: var(--space-4);
	}

	.progress-card {
		display: grid;
		gap: var(--space-4);
	}

	.primary-action {
		display: grid;
		gap: var(--space-2);
		justify-items: center;
		text-align: center;
	}

	.primary-action :global(.glow) {
		width: 100%;
	}

	@media (min-width: 640px) {
		.primary-action :global(.glow) {
			width: 360px;
		}
	}

	.section-title {
		margin-bottom: var(--space-3);
	}

	.grid {
		display: grid;
		gap: var(--space-4);
		padding: 0;
		margin: 0;
		list-style: none;
	}

	@media (min-width: 640px) {
		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.list-card {
		display: grid;
		gap: var(--space-3);
		height: 100%;
		align-content: space-between;
	}

	.list-title {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: var(--text-display-m);
		line-height: var(--leading-display-m);
		overflow-wrap: anywhere;
		padding-right: var(--space-4);
	}

	.rows {
		display: grid;
		gap: var(--space-2);
	}

	.row {
		display: grid;
		grid-template-columns: 3rem minmax(0, 1fr) 6.5rem;
		align-items: center;
		gap: var(--space-3);
	}

	.row-count {
		text-align: right;
	}

	.due {
		color: var(--color-energy);
		font-weight: 600;
	}

	.notice {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--color-primary-tint);
		border: 1px solid var(--color-primary-light);
		border-radius: var(--radius-m);
	}

	.notice-text {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}

	.notice a {
		color: var(--color-primary-light);
		font-weight: 600;
	}

	.close {
		display: grid;
		place-items: center;
		flex: none;
		width: var(--touch-target);
		height: var(--touch-target);
		margin: calc(var(--space-3) * -1) calc(var(--space-4) * -1) calc(var(--space-3) * -1) 0;
		background: transparent;
		border: 0;
		border-radius: var(--radius-m);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.close:hover {
		color: var(--color-text);
	}

	.empty-actions {
		display: grid;
		gap: var(--space-3);
		width: min(320px, 80vw);
	}

	.skeleton {
		border-radius: var(--radius-m);
		background: var(--color-surface);
		animation: pulse 1.4s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			background: var(--color-surface-raised);
		}
	}
</style>
