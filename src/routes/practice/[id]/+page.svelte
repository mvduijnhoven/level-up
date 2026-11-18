<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getStore } from '#lib/data/index.ts';
	import type { GameMode, Item, Profile, Progress, SessionDirection, WordList } from '#lib/domain/types.ts';
	import { PracticeSession, loadSession } from '#lib/app/session.svelte.ts';
	import { playSound, vibrate } from '#lib/app/sound.ts';
	import { listHref, listsHref } from '#lib/app/lists-links.ts';
	import AnswerInput from '#lib/ui/AnswerInput.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import ChoiceList from '#lib/ui/ChoiceList.svelte';
	import ComboCounter from '#lib/ui/ComboCounter.svelte';
	import Confetti from '#lib/ui/Confetti.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import EmptyState from '#lib/ui/EmptyState.svelte';
	import FeedbackBar from '#lib/ui/FeedbackBar.svelte';
	import MasteryMeter from '#lib/ui/MasteryMeter.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import ProgressBar from '#lib/ui/ProgressBar.svelte';
	import StatChip from '#lib/ui/StatChip.svelte';
	import TimerBar from '#lib/ui/TimerBar.svelte';
	import XpBar from '#lib/ui/XpBar.svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import Clock from '@lucide/svelte/icons/clock';
	import Flame from '@lucide/svelte/icons/flame';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Volume2 from '@lucide/svelte/icons/volume-2';
	import VolumeX from '@lucide/svelte/icons/volume-x';
	import X from '@lucide/svelte/icons/x';
	import Zap from '@lucide/svelte/icons/zap';

	let loading = $state(true);
	let list = $state<WordList | null>(null);
	let items = $state<Item[]>([]);
	let progress = $state<Progress[]>([]);
	let profile = $state<Profile | null>(null);
	let speedrunHighscore = $state<number | null>(null);

	// Setup-toestand
	let inSetup = $state(true);
	let selectedDirection = $state<SessionDirection>('forward');
	let selectedMode = $state<GameMode>('learn');

	// Sessie-toestand
	let session = $state<PracticeSession | null>(null);
	let answerText = $state('');
	let answerInputComponent = $state<{ focus: () => void } | null>(null);
	let quitDialogOpen = $state(false);
	let advanceTimer: ReturnType<typeof setTimeout> | null = null;
	let tickRafId: number | null = null;

	const id = $derived(page.params.id);

	async function loadData(listId: string) {
		loading = true;
		try {
			const store = getStore();
			const [l, itms, prog, prof] = await Promise.all([
				store.lists.get(listId),
				store.items.byList(listId),
				store.progress.byList(listId),
				store.profile.get()
			]);
			list = l ?? null;
			items = itms;
			progress = prog;
			profile = prof;
			await loadHighscore(listId, selectedDirection);
		} catch {
			list = null;
		} finally {
			loading = false;
		}
	}

	async function loadHighscore(listId: string, dir: SessionDirection) {
		try {
			const store = getStore();
			const hs = await store.highscores.get(listId, dir, 'speedrun');
			speedrunHighscore = hs ? hs.score : null;
		} catch {
			speedrunHighscore = null;
		}
	}

	$effect(() => {
		if (id) {
			void loadData(id);
		}
	});

	$effect(() => {
		if (id && inSetup) {
			void loadHighscore(id, selectedDirection);
		}
	});

	async function startSession(extra = false) {
		if (!list || !id) return;
		inSetup = false;
		clearAdvanceTimer();

		const store = getStore();
		session = await loadSession({
			store,
			listId: id,
			direction: selectedDirection,
			mode: selectedMode,
			extra,
			now: () => Date.now(),
			rng: () => Math.random()
		});

		answerText = '';
		startTickLoop();
	}

	function startTickLoop() {
		stopTickLoop();
		if (selectedMode !== 'speedrun') return;

		function loop() {
			if (session && session.status === 'asking') {
				session.tick(Date.now());
			}
			tickRafId = requestAnimationFrame(loop);
		}
		tickRafId = requestAnimationFrame(loop);
	}

	function stopTickLoop() {
		if (tickRafId !== null) {
			cancelAnimationFrame(tickRafId);
			tickRafId = null;
		}
	}

	function clearAdvanceTimer() {
		if (advanceTimer !== null) {
			clearTimeout(advanceTimer);
			advanceTimer = null;
		}
	}

	// Behandel antwoord-geluidseffecten en auto-advance
	function handleAfterAnswer() {
		if (!session || !session.feedback) return;
		const fb = session.feedback;
		const soundOn = profile?.soundOn ?? false;
		const vibrationOn = profile?.vibrationOn ?? false;

		playSound(fb.result, soundOn);

		if (fb.result === 'wrong') {
			vibrate([80], vibrationOn);
		}

		if (session.combo > 0 && session.combo % 5 === 0) {
			playSound('combo', soundOn);
		}

		// Auto-advance alleen bij goed antwoord
		if (fb.result === 'correct') {
			clearAdvanceTimer();
			const delay = selectedMode === 'speedrun' ? 380 : 750;
			advanceTimer = setTimeout(() => {
				goNext();
			}, delay);
		}
	}

	function submitTyping(text: string) {
		if (!session || session.status !== 'asking') return;
		clearAdvanceTimer();
		session.submitAnswer(text);
		handleAfterAnswer();
	}

	function selectChoice(index: number) {
		if (!session || session.status !== 'asking') return;
		clearAdvanceTimer();
		session.selectChoice(index);
		handleAfterAnswer();
	}

	function goNext() {
		clearAdvanceTimer();
		if (!session) return;
		if (session.status === 'feedback') {
			session.next();
			answerText = '';
			const curStatus = session.status as string;
			if (curStatus === 'asking' && session.question?.form === 'typing') {
				void tick().then(() => answerInputComponent?.focus());
			}
			if (curStatus === 'finished') {
				stopTickLoop();
				if (session.summary?.levelUp) {
					playSound('levelUp', profile?.soundOn ?? false);
				}
			}
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (session && session.status === 'feedback' && event.key === 'Enter') {
			event.preventDefault();
			goNext();
		}
	}

	async function toggleSound() {
		if (!profile) return;
		const next = !profile.soundOn;
		profile = { ...profile, soundOn: next };
		try {
			await getStore().profile.update({ soundOn: next });
		} catch {
			// Stil negeren
		}
	}

	function askQuit() {
		if (!session || session.status === 'finished') {
			inSetup = true;
			return;
		}
		quitDialogOpen = true;
	}

	function confirmQuit() {
		quitDialogOpen = false;
		clearAdvanceTimer();
		stopTickLoop();
		if (session) {
			session.quit();
		}
		inSetup = true;
	}

	function formatDuration(ms: number): string {
		const seconds = Math.round(ms / 1000);
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		if (m === 0) return `${s} s`;
		return `${m} m ${s} s`;
	}

	onDestroy(() => {
		clearAdvanceTimer();
		stopTickLoop();
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>{list ? `Oefenen: ${list.title}` : 'Oefenen'} · Level Up</title>
</svelte:head>

{#if loading}
	<PageHeader title="Oefenen" />
	<p class="muted" role="status">Lijst laden…</p>
{:else if !list}
	<PageHeader title="Oefenen" />
	<EmptyState
		icon={BookOpen}
		title="Lijst niet gevonden"
		text="Deze lijst bestaat niet of is verwijderd."
	>
		{#snippet action()}
			<Button variant="primary" href={listsHref()}>Naar alle lijsten</Button>
		{/snippet}
	</EmptyState>
{:else if inSetup}
	<!-- SETUP-SCHERM -->
	<PageHeader
		title={list.title}
		backHref={listHref(list.id)}
		backLabel="Lijst beheren"
		subtitle={`${list.source} → ${list.target} · ${items.length} ${items.length === 1 ? 'woord' : 'woorden'}`}
	>
		{#snippet action()}
			<button
				type="button"
				class="sound-btn"
				onclick={toggleSound}
				aria-label={profile?.soundOn ? 'Geluid uitschakelen' : 'Geluid inschakelen'}
				title={profile?.soundOn ? 'Geluid uitschakelen' : 'Geluid inschakelen'}
			>
				{#if profile?.soundOn}
					<Volume2 size={22} aria-hidden="true" />
				{:else}
					<VolumeX size={22} aria-hidden="true" />
				{/if}
			</button>
		{/snippet}
	</PageHeader>

	{#if items.length === 0}
		<EmptyState
			icon={BookOpen}
			title="Nog geen woorden in deze lijst"
			text="Voeg eerst woorden toe aan deze lijst om te kunnen oefenen."
		>
			{#snippet action()}
				{#if list}
					<Button variant="primary" href={listHref(list.id)}>Woorden toevoegen</Button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<div class="setup-stack">
			<!-- Spelmodus kiezen -->
			<fieldset class="option-group">
				<legend class="group-title">Kies je spelmodus</legend>
				<div class="mode-grid">
					<button
						type="button"
						class="mode-card"
						class:selected={selectedMode === 'learn'}
						onclick={() => (selectedMode = 'learn')}
					>
						<span class="mode-icon"><BookOpen size={28} /></span>
						<span class="mode-info">
							<strong class="mode-name">Leermodus</strong>
							<span class="small muted">Oefen op je eigen tempo zonder tijdsdruk.</span>
						</span>
					</button>

					<button
						type="button"
						class="mode-card"
						class:selected={selectedMode === 'speedrun'}
						onclick={() => (selectedMode = 'speedrun')}
					>
						<span class="mode-icon energy"><Zap size={28} /></span>
						<span class="mode-info">
							<strong class="mode-name">Speedrun</strong>
							<span class="small muted">Scoor zoveel mogelijk punten binnen 60 seconden.</span>
							{#if speedrunHighscore !== null}
								<span class="highscore small">
									<Trophy size={14} aria-hidden="true" />
									Record: {speedrunHighscore} pt
								</span>
							{/if}
						</span>
					</button>
				</div>
			</fieldset>

			<!-- Richting kiezen (LD-04) -->
			<fieldset class="option-group">
				<legend class="group-title">Richting</legend>
				<div class="direction-grid">
					<button
						type="button"
						class="dir-card"
						class:selected={selectedDirection === 'forward'}
						onclick={() => (selectedDirection = 'forward')}
					>
						<strong class="dir-title">Heen</strong>
						<span class="small muted">{list.source} → {list.target}</span>
					</button>

					<button
						type="button"
						class="dir-card"
						class:selected={selectedDirection === 'backward'}
						onclick={() => (selectedDirection = 'backward')}
					>
						<strong class="dir-title">Terug</strong>
						<span class="small muted">{list.target} → {list.source}</span>
					</button>

					<button
						type="button"
						class="dir-card"
						class:selected={selectedDirection === 'both'}
						onclick={() => (selectedDirection = 'both')}
					>
						<strong class="dir-title">Beide</strong>
						<span class="small muted">Door elkaar heen</span>
					</button>
				</div>
			</fieldset>

			<div class="start-action">
				<Button variant="primary" block onclick={() => startSession(false)}>
					{selectedMode === 'speedrun' ? 'Start Speedrun' : 'Start Leermodus'}
				</Button>
			</div>
		</div>
	{/if}
{:else if session}
	<!-- ACTIEVE SESSIE OF RESULTAAT -->
	{#if session.status === 'nothing-due'}
		<PageHeader title="Alles bijgewerkt" />
		<Card as="section">
			<div class="center-content">
				<span class="accent-success"><CheckCircle2 size={48} aria-hidden="true" /></span>
				<h2>Je bent helemaal bij!</h2>
				<p class="muted">
					{#if session.emptyReason === 'empty-list'}
						Er zitten geen woorden in deze lijst.
					{:else}
						Alle woorden zijn al geoefend en nog niet aan herhaling toe volgens het schema.
					{/if}
				</p>
				<div class="actions-row">
					<Button variant="primary" onclick={() => startSession(true)}>Toch extra oefenen</Button>
					<Button variant="secondary" onclick={() => (inSetup = true)}>Terug naar instellingen</Button>
				</div>
			</div>
		</Card>
	{:else if session.status === 'needs-learning'}
		<PageHeader title="Eerst oefenen" />
		<Card as="section">
			<div class="center-content">
				<span class="accent-energy"><BookOpen size={48} aria-hidden="true" /></span>
				<h2>Nog niet genoeg geoefend</h2>
				<p class="muted">
					Voor een Speedrun heb je minimaal {session.minPool} geoefende woorden nodig in deze richting.
					Je hebt er nu {session.poolSize}.
				</p>
				<div class="actions-row">
					<Button
						variant="primary"
						onclick={() => {
							selectedMode = 'learn';
							startSession(false);
						}}
					>
						Oefen eerst in Leermodus
					</Button>
					<Button variant="secondary" onclick={() => (inSetup = true)}>Ander richting kiezen</Button>
				</div>
			</div>
		</Card>
	{:else if session.status === 'finished' && session.summary}
		<!-- RESULTAATSCHERM (Resultaatscherm) -->
		{@const s = session.summary}
		{#if s.levelUp}
			<Confetti active={s.levelUp} />
		{/if}

		<div class="result-view">
			<div class="result-header">
				{#if s.newRecord}
					<div class="record-badge" role="status">
						<Trophy size={20} aria-hidden="true" />
						<span>Nieuw persoonlijk record!</span>
					</div>
				{/if}

				<h1 class="result-title">
					{session.mode === 'speedrun' ? 'Tijd is om!' : 'Sessie voltooid!'}
				</h1>

				<div class="main-stat">
					{#if session.mode === 'speedrun'}
						<span class="main-stat-val num energy">{s.score}</span>
						<span class="main-stat-lbl">punten gescoord</span>
					{:else}
						<span class="main-stat-val num xp">+{s.xpEarned}</span>
						<span class="main-stat-lbl">XP verdiend</span>
					{/if}
				</div>

				{#if s.levelUp}
					<div class="levelup-banner">
						<strong>Nieuw niveau bereikt!</strong>
						<span>Je bent nu niveau {s.levelAfter.level}!</span>
					</div>
				{/if}
			</div>

			<!-- Voortgang niveau -->
			<Card as="section">
				<XpBar
					level={s.levelAfter.level}
					progress={s.levelAfter.progress}
					detail="{s.levelAfter.xpIntoLevel} / {s.levelAfter.xpForNextLevel} XP"
				/>
			</Card>

			<!-- Statistieken chips -->
			<div class="stats-grid">
				<StatChip label="Beantwoord" value={s.answered} color="primary" />
				<StatChip label="Goed" value={s.correct} color="success" />
				<StatChip label="Bijna goed" value={s.almost} color="energy" />
				<StatChip label="Fout" value={s.wrong} color="boss" />
				<StatChip
					label="Max combo"
					value={s.maxCombo > 1 ? `×${s.maxCombo}` : '1'}
					color="energy"
				/>
				<StatChip label="Duur" value={formatDuration(s.durationMs)} color="muted" />
			</div>

			<!-- Gegroeide woorden -->
			{#if s.improved.length > 0}
				<Card as="section" class="improved-card">
					<h2>Gegroeide woorden ({s.improved.length})</h2>
					<ul class="improved-list" role="list">
						{#each s.improved as imp (imp.itemId + imp.direction)}
							<li class="improved-item">
								<div class="imp-words">
									<strong>{imp.term}</strong>
									<span class="small muted">{imp.translation}</span>
								</div>
								<MasteryMeter level={imp.to} />
							</li>
						{/each}
					</ul>
				</Card>
			{/if}

			<div class="result-actions">
				<Button variant="primary" block onclick={() => startSession(false)}>
					<RotateCcw size={20} aria-hidden="true" />
					Nog een keer oefenen
				</Button>
				<Button variant="secondary" block href={listHref(list.id)}>Terug naar lijst</Button>
				<Button variant="text" block href={listsHref()}>Naar alle lijsten</Button>
			</div>
		</div>
	{:else if session.status === 'asking' || session.status === 'feedback'}
		<!-- VRAAG EN FEEDBACK (Focus Mode) -->
		<div class="session-view">
			<!-- Bovenbalk van de oefensessie -->
			<div class="session-bar">
				<button
					type="button"
					class="icon-btn"
					onclick={askQuit}
					aria-label="Sessie verlaten"
					title="Sessie verlaten"
				>
					<X size={24} aria-hidden="true" />
				</button>

				<div class="bar-center">
					{#if session.mode === 'speedrun'}
						<TimerBar remainingMs={session.timeLeftMs} totalMs={session.totalMs} />
					{:else}
						<ProgressBar
							value={session.total > 0 ? session.index / session.total : 0}
							label="Voortgang"
							valueText="Vraag {session.index} van {session.total}"
							color="primary"
							size="thin"
						/>
					{/if}
				</div>

				<div class="bar-right">
					{#if session.mode === 'speedrun'}
						<span class="score num">{session.score} pt</span>
					{/if}
					<button
						type="button"
						class="icon-btn sound-toggle"
						onclick={toggleSound}
						aria-label={profile?.soundOn ? 'Geluid uitschakelen' : 'Geluid inschakelen'}
						title={profile?.soundOn ? 'Geluid uitschakelen' : 'Geluid inschakelen'}
					>
						{#if profile?.soundOn}
							<Volume2 size={20} aria-hidden="true" />
						{:else}
							<VolumeX size={20} aria-hidden="true" />
						{/if}
					</button>
				</div>
			</div>

			<!-- Status indicator: combo & xp -->
			<div class="session-subbar">
				{#if session.combo >= 2}
					<ComboCounter count={session.combo} />
				{:else}
					<div></div>
				{/if}

				{#if session.mode === 'learn' && session.xpEarned > 0}
					<span class="earned-xp num">+{session.xpEarned} XP</span>
				{/if}
			</div>

			<!-- De vraag (Prompt Card) -->
			{#if session.question}
				{@const q = session.question}
				<div class="prompt-card">
					<div class="prompt-meta">
						<span class="prompt-dir small muted">
							{q.fromLang} → {q.toLang}
						</span>
						{#if q.isNew}
							<span class="new-badge small">Nieuw woord</span>
						{/if}
					</div>

					<p class="prompt-text">{q.prompt}</p>
				</div>

				<!-- Interactie: Meerkeuze of Typen -->
				<div class="interaction-area">
					{#if q.form === 'choice'}
						<ChoiceList
							options={q.options}
							disabled={session.status === 'feedback'}
							revealed={session.feedback
								? {
										selected: session.feedback.selectedIndex,
										correct: session.feedback.correctIndex
									}
								: undefined}
							onselect={selectChoice}
						/>
					{:else}
						<AnswerInput
							bind:this={answerInputComponent}
							bind:value={answerText}
							lang={q.answerLang}
							specialChars={q.specialChars}
							disabled={session.status === 'feedback'}
							feedback={session.feedback?.result ?? null}
							onsubmit={submitTyping}
						/>
					{/if}
				</div>
			{/if}

			<!-- Feedback balk onderaan -->
			{#if session.status === 'feedback' && session.feedback}
				{@const fb = session.feedback}
				<div class="feedback-container">
					<FeedbackBar
						result={fb.result}
						correctAnswer={fb.correctAnswer}
						givenAnswer={fb.givenAnswer}
						segments={fb.segments}
						xp={fb.xp}
						message={fb.message}
						example={fb.example}
						canOverride={fb.canOverride}
						onoverride={() => {
							session?.overrideAsCorrect();
							playSound('correct', profile?.soundOn ?? false);
						}}
						onnext={goNext}
						nextLabel={session.index >= session.total && session.mode === 'learn' ? 'Bekijk resultaat' : 'Verder'}
					/>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<!-- Bevestigingsdialoog bij stoppen -->
<Dialog
	bind:open={quitDialogOpen}
	title="Sessie stoppen?"
>
	<p>Je verdiende XP en voortgang tot nu toe blijven bewaard.</p>
	{#snippet actions()}
		<Button variant="secondary" onclick={() => (quitDialogOpen = false)}>Doorgaan met oefenen</Button>
		<Button variant="primary" onclick={confirmQuit}>Ja, stoppen</Button>
	{/snippet}
</Dialog>

<style>
	.sound-btn {
		display: grid;
		place-items: center;
		width: var(--touch-target);
		height: var(--touch-target);
		background: transparent;
		border: 0;
		color: var(--color-text-muted);
		border-radius: var(--radius-m);
		cursor: pointer;
	}

	.sound-btn:hover {
		color: var(--color-text);
		background: var(--color-surface-raised);
	}

	.setup-stack {
		display: grid;
		gap: var(--space-6);
		max-width: var(--content-narrow);
		margin-inline: auto;
	}

	.option-group {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-3);
	}

	.group-title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: var(--text-display-m);
		color: var(--color-text);
		margin-bottom: var(--space-2);
	}

	.mode-grid {
		display: grid;
		gap: var(--space-3);
	}

	@media (min-width: 540px) {
		.mode-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.mode-card {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--color-surface);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-m);
		color: var(--color-text);
		cursor: pointer;
		text-align: left;
		transition:
			border-color var(--duration-fast),
			background-color var(--duration-fast);
	}

	.mode-card:hover {
		border-color: var(--color-border-strong);
		background: var(--color-surface-raised);
	}

	.mode-card.selected {
		border-color: var(--color-primary);
		background: var(--color-surface-raised);
		box-shadow: 0 0 12px rgba(108, 71, 255, 0.25);
	}

	.mode-icon {
		flex: none;
		color: var(--color-primary-light);
	}

	.mode-icon.energy {
		color: var(--color-energy);
	}

	.mode-info {
		display: grid;
		gap: 2px;
	}

	.mode-name {
		font-family: var(--font-display);
		font-size: var(--text-display-m);
	}

	.highscore {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--color-xp);
		font-weight: 600;
		margin-top: 4px;
	}

	.direction-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-2);
	}

	.dir-card {
		display: grid;
		gap: 2px;
		padding: var(--space-3);
		background: var(--color-surface);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-m);
		color: var(--color-text);
		cursor: pointer;
		text-align: center;
		transition:
			border-color var(--duration-fast),
			background-color var(--duration-fast);
	}

	.dir-card:hover {
		border-color: var(--color-border-strong);
	}

	.dir-card.selected {
		border-color: var(--color-energy);
		background: var(--color-surface-raised);
	}

	.dir-title {
		font-family: var(--font-display);
		font-weight: 700;
	}

	.start-action {
		margin-top: var(--space-2);
	}

	/* SESSIE SCHERM */
	.session-view {
		display: grid;
		gap: var(--space-4);
		width: 100%;
		max-width: var(--content-narrow);
		margin-inline: auto;
		min-height: calc(100dvh - var(--space-8));
		align-content: start;
	}

	.session-bar {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--touch-target);
	}

	.bar-center {
		min-width: 0;
	}

	.bar-right {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.score {
		font-family: var(--font-display);
		font-weight: 700;
		color: var(--color-energy);
		font-size: var(--text-display-m);
	}

	.icon-btn {
		display: grid;
		place-items: center;
		width: var(--touch-target);
		height: var(--touch-target);
		background: transparent;
		border: 0;
		border-radius: var(--radius-full);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.icon-btn:hover {
		color: var(--color-text);
		background: var(--color-surface);
	}

	.session-subbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 28px;
	}

	.earned-xp {
		font-family: var(--font-display);
		font-weight: 700;
		color: var(--color-xp);
		font-size: var(--text-body);
	}

	.prompt-card {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-6) var(--space-4);
		background: var(--color-surface);
		border-radius: var(--radius-m);
		border-top-right-radius: 0;
		border: 1px solid var(--color-border);
		text-align: center;
	}

	.prompt-meta {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--space-2);
	}

	.new-badge {
		background: var(--color-primary-tint);
		color: var(--color-primary-light);
		padding: 2px 8px;
		border-radius: var(--radius-full);
		font-weight: 600;
	}

	.prompt-text {
		font-family: var(--font-text);
		font-size: var(--text-prompt);
		line-height: var(--leading-prompt);
		font-weight: 600;
		color: var(--color-text);
		overflow-wrap: anywhere;
	}

	.interaction-area {
		margin-top: var(--space-2);
	}

	.feedback-container {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: var(--z-nav);
		max-width: var(--content-narrow);
		margin-inline: auto;
	}

	/* RESULTAATSCHERM */
	.result-view {
		display: grid;
		gap: var(--space-4);
		max-width: var(--content-narrow);
		margin-inline: auto;
	}

	.result-header {
		display: grid;
		gap: var(--space-2);
		text-align: center;
		padding: var(--space-4) 0;
	}

	.record-badge {
		display: inline-flex;
		align-items: center;
		justify-self: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		background: var(--color-xp);
		color: var(--color-ink);
		font-weight: 700;
		border-radius: var(--radius-full);
		animation: pop 0.4s var(--ease-out);
	}

	.result-title {
		font-family: var(--font-display);
		font-size: var(--text-display-xl);
		line-height: var(--leading-display-xl);
	}

	.main-stat {
		display: grid;
		gap: 2px;
	}

	.main-stat-val {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 3rem;
		line-height: 1;
	}

	.main-stat-val.energy {
		color: var(--color-energy);
	}

	.main-stat-val.xp {
		color: var(--color-xp);
	}

	.main-stat-lbl {
		color: var(--color-text-muted);
		font-size: var(--text-body);
	}

	.levelup-banner {
		display: grid;
		gap: 2px;
		padding: var(--space-3);
		background: var(--color-xp);
		color: var(--color-ink);
		border-radius: var(--radius-m);
		margin-top: var(--space-2);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-2);
	}

	@media (min-width: 500px) {
		.stats-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	:global(.improved-card) {
		display: grid;
		gap: var(--space-3);
	}

	.improved-list {
		display: grid;
		gap: var(--space-2);
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.improved-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-2) var(--space-3);
		background: var(--color-surface);
		border-radius: var(--radius-s);
		gap: var(--space-3);
	}

	.imp-words {
		display: grid;
		gap: 2px;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.result-actions {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	.center-content {
		display: grid;
		gap: var(--space-3);
		justify-items: center;
		text-align: center;
		padding: var(--space-6) var(--space-4);
	}

	.accent-success {
		color: var(--color-success);
	}

	.accent-energy {
		color: var(--color-energy);
	}

	.actions-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		justify-content: center;
		margin-top: var(--space-2);
	}

	@keyframes pop {
		0% {
			transform: scale(0.85);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
