<script module lang="ts">
	export interface DiffSegment {
		text: string;
		/** true = dit stuk wijkt af van het gegeven antwoord. */
		mismatch: boolean;
	}
</script>

<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import X from '@lucide/svelte/icons/x';
	import type { LucideIcon } from '@lucide/svelte';
	import type { AnswerResult } from '#lib/domain/types.ts';
	import Button from './Button.svelte';

	interface Props {
		/** `null` = niets tonen (het live-gebied blijft bestaan zodat schermlezers de melding oppikken). */
		result: AnswerResult | null;
		correctAnswer?: string;
		givenAnswer?: string;
		/** Het juiste antwoord in stukken, met het verschil gemarkeerd. */
		segments?: DiffSegment[];
		xp?: number;
		/** Vervangt de standaardtitel. */
		message?: string;
		example?: string;
		canOverride?: boolean;
		onoverride?: () => void;
		onnext?: () => void;
		nextLabel?: string;
		showNext?: boolean;
	}

	let {
		result,
		correctAnswer,
		givenAnswer,
		segments,
		xp,
		message,
		example,
		canOverride = false,
		onoverride,
		onnext,
		nextLabel = 'Verder',
		showNext = true
	}: Props = $props();

	const TITLES: Record<AnswerResult, string> = {
		correct: 'Goed zo!',
		almost: 'Bijna goed!',
		wrong: 'Nog niet goed'
	};
	const ICONS: Record<AnswerResult, LucideIcon> = {
		correct: Check,
		almost: CircleAlert,
		wrong: X
	};

	const Icon = $derived(result ? ICONS[result] : null);
	const title = $derived(result ? (message ?? TITLES[result]) : '');
	const label = $derived(result === 'almost' ? 'Juiste antwoord' : 'Het juiste antwoord');
</script>

<div class="live" role="status" aria-live="polite" aria-atomic="true">
	{#if result && Icon}
		<div class="bar {result}">
			<div class="body">
				<span class="badge" aria-hidden="true"><Icon size={24} strokeWidth={3} /></span>
				<div class="text">
					<p class="title">{title}</p>
					{#if result !== 'correct' && (segments?.length || correctAnswer)}
						<p class="answer-line">
							<span class="small muted">{label}:</span>
							<strong class="answer-value">
								{#if segments?.length}
									{#each segments as seg, i (i)}<span class:mismatch={seg.mismatch}>{seg.text}</span>{/each}
								{:else}
									{correctAnswer}
								{/if}
							</strong>
						</p>
					{/if}
					{#if result === 'wrong' && givenAnswer}
						<p class="small muted">Jouw antwoord: <span class="given">{givenAnswer}</span></p>
					{/if}
					{#if result === 'almost'}
						<p class="small muted">Let op het gemarkeerde verschil.</p>
					{/if}
					{#if example}
						<p class="small muted example">{example}</p>
					{/if}
				</div>
				{#if xp !== undefined && xp > 0}
					<span class="xp num">+{xp} XP</span>
				{/if}
			</div>
			<div class="actions">
				{#if canOverride && onoverride}
					<button type="button" class="override-btn small" onclick={onoverride}>
						Ik had het goed
					</button>
				{/if}
				{#if showNext && onnext}
					<Button variant={result === 'correct' ? 'secondary' : 'primary'} block onclick={onnext}>
						{nextLabel}
					</Button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.bar {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--color-surface-raised);
		background-image: linear-gradient(var(--tint), var(--tint));
		border-top: 3px solid var(--accent);
		border-radius: var(--radius-m) var(--radius-m) 0 0;
		animation: slide-up var(--duration-base) var(--ease-out);
	}

	.correct {
		--accent: var(--color-success);
		--tint: var(--color-success-tint);
	}
	.almost {
		--accent: var(--color-warning);
		--tint: var(--color-warning-tint);
	}
	.wrong {
		--accent: var(--color-error);
		--tint: var(--color-error-tint);
	}

	.body {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
	}

	.badge {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--color-ink);
	}

	.text {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: var(--space-1);
	}

	.title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: var(--text-display-m);
		line-height: var(--leading-display-m);
		color: var(--accent);
	}

	.answer-line {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space-1) var(--space-2);
	}

	.answer-value {
		font-family: var(--font-text);
		font-size: var(--text-answer);
		line-height: var(--leading-answer);
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	/* Het verschil is ook zonder kleur zichtbaar: onderstreept */
	.mismatch {
		color: var(--color-warning);
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 4px;
	}

	.wrong .answer-value {
		color: var(--color-text);
	}

	.given {
		text-decoration: line-through;
		text-decoration-thickness: 1px;
	}

	.xp {
		flex: none;
		font-family: var(--font-display);
		font-weight: 700;
		font-size: var(--text-display-m);
		color: var(--color-xp);
		animation: pop-in var(--duration-slow) var(--ease-out);
	}

	.actions {
		display: grid;
		gap: var(--space-2);
		width: 100%;
	}

	.override-btn {
		background: none;
		border: 0;
		color: var(--color-primary-light);
		text-decoration: underline;
		cursor: pointer;
		padding: var(--space-1);
		font-family: inherit;
		text-align: center;
	}

	.override-btn:hover {
		color: var(--color-text);
	}

	.example {
		font-style: italic;
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(24px);
		}
	}

	@keyframes pop-in {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.9);
		}
	}
</style>