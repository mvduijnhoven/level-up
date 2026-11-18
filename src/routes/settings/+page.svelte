<script lang="ts">
	import { onMount } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Download from '@lucide/svelte/icons/download';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Upload from '@lucide/svelte/icons/upload';
	import {
		downloadBackup, estimateStorage, getStore, readBackupFile, requestPersistentStorage,
		type StorageEstimate
	} from '#lib/data/index.ts';
	import { DEFAULT_INTERVALS_DAYS, type Profile } from '#lib/domain/types.ts';
	import { validateIntervals } from '#lib/domain/leitner.ts';
	import { wordsLabel } from '#lib/app/library-service.ts';
	import Button from '#lib/ui/Button.svelte';
	import Card from '#lib/ui/Card.svelte';
	import Dialog from '#lib/ui/Dialog.svelte';
	import PageHeader from '#lib/ui/PageHeader.svelte';
	import TextField from '#lib/ui/TextField.svelte';
	import Toggle from '#lib/ui/Toggle.svelte';
	import { toasts } from '#lib/ui/toast.svelte.ts';
	import { uiSettings } from '#lib/ui/ui-settings.svelte.ts';

	const store = getStore();
	const CONFIRM_WORD = 'verwijderen';

	let profile = $state<Profile | null>(null);
	let intervalInputs = $state<string[]>(DEFAULT_INTERVALS_DAYS.map(String));
	let strictAccents = $state(false);
	let soundOn = $state(false);
	let reduceMotion = $state(false);
	let vibrationOn = $state(false);
	let weeklyGoalDays = $state('4');
	let canVibrate = $state(false);

	let storageEstimate = $state<StorageEstimate | null>(null);
	let persisted = $state<boolean | null>(null);

	let fileInput = $state<HTMLInputElement>();
	let pendingBackup = $state<unknown>(null);
	let restoreOpen = $state(false);
	let restoring = $state(false);
	let backupError = $state('');
	let backupBusy = $state(false);

	let deleteOpen = $state(false);
	let deleteText = $state('');
	let deleting = $state(false);

	const intervals = $derived(intervalInputs.map((value) => (value.trim() === '' ? 0 : Number(value))));
	const intervalError = $derived(validateIntervals(intervals));
	const intervalsChanged = $derived(
		profile !== null && intervals.some((value, i) => value !== profile!.intervalsDays[i])
	);
	const isDefaultIntervals = $derived(intervals.every((value, i) => value === DEFAULT_INTERVALS_DAYS[i]));
	const deleteConfirmed = $derived(deleteText.trim().toLowerCase() === CONFIRM_WORD);

	function applyProfile(next: Profile) {
		profile = next;
		intervalInputs = next.intervalsDays.map(String);
		strictAccents = next.strictAccents;
		soundOn = next.soundOn;
		reduceMotion = next.reduceMotion;
		vibrationOn = next.vibrationOn;
		weeklyGoalDays = String(next.weeklyGoalDays);
		uiSettings.reduceMotion = next.reduceMotion;
	}

	async function refreshStorage() {
		storageEstimate = await estimateStorage();
		try {
			persisted = (await navigator.storage?.persisted?.()) ?? null;
		} catch {
			persisted = null;
		}
	}

	onMount(() => {
		canVibrate = typeof navigator.vibrate === 'function';
		store.profile.get().then(applyProfile);
		refreshStorage();
	});

	async function save(patch: Partial<Omit<Profile, 'id'>>, message: string): Promise<boolean> {
		try {
			profile = await store.profile.update(patch);
			toasts.show(message, 'success');
			return true;
		} catch {
			toasts.show('Opslaan is niet gelukt. Probeer het opnieuw.', 'error');
			return false;
		}
	}

	async function saveIntervals() {
		if (intervalError) return;
		await save({ intervalsDays: intervals }, 'Herhaalintervallen opgeslagen');
	}

	async function resetIntervals() {
		intervalInputs = DEFAULT_INTERVALS_DAYS.map(String);
		await save({ intervalsDays: [...DEFAULT_INTERVALS_DAYS] }, 'Standaardwaarden hersteld');
	}

	async function setStrictAccents(value: boolean) {
		await save({ strictAccents: value }, value ? 'Accenten tellen nu mee' : 'Accenten tellen niet meer mee');
	}

	async function setSound(value: boolean) {
		await save({ soundOn: value }, value ? 'Geluidseffecten staan aan' : 'Geluidseffecten staan uit');
	}

	async function setWeeklyGoal() {
		await save({ weeklyGoalDays: Number(weeklyGoalDays) }, 'Weekdoel opgeslagen');
	}

	async function setReduceMotion(value: boolean) {
		uiSettings.reduceMotion = value;
		await save({ reduceMotion: value }, value ? 'Minder beweging staat aan' : 'Minder beweging staat uit');
	}

	async function setVibration(value: boolean) {
		await save({ vibrationOn: value }, value ? 'Trillen staat aan' : 'Trillen staat uit');
	}

	async function makeBackup() {
		backupBusy = true;
		backupError = '';
		try {
			await downloadBackup(store);
			profile = await store.profile.get();
			toasts.show('Back-up gemaakt. Bewaar het bestand op een veilige plek.', 'success');
		} catch {
			backupError = 'De back-up kon niet worden gemaakt. Probeer het opnieuw.';
		} finally {
			backupBusy = false;
		}
	}

	async function onFileChosen(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		backupError = '';
		try {
			pendingBackup = await readBackupFile(file);
			restoreOpen = true;
		} catch (error) {
			backupError = error instanceof Error ? error.message : 'Het bestand kon niet worden gelezen.';
		}
	}

	async function restoreBackup() {
		restoring = true;
		try {
			await store.importAll(pendingBackup);
			applyProfile(await store.profile.get());
			const lists = await store.lists.all();
			const counts = await Promise.all(lists.map((list) => store.items.countByList(list.id)));
			const words = counts.reduce((sum, n) => sum + n, 0);
			toasts.show(
				`Back-up teruggezet: ${lists.length === 1 ? '1 lijst' : `${lists.length} lijsten`}, ${wordsLabel(words)}`,
				'success',
				6000
			);
			refreshStorage();
		} catch (error) {
			backupError =
				error instanceof Error
					? error.message
					: 'Dit bestand kon niet worden teruggezet. Je huidige gegevens zijn niet gewijzigd.';
		} finally {
			restoring = false;
			restoreOpen = false;
			pendingBackup = null;
		}
	}

	async function askPersistent() {
		const granted = await requestPersistentStorage();
		await refreshStorage();
		if (granted) toasts.show('Je gegevens worden nu blijvend bewaard', 'success');
		else toasts.show('De browser geeft geen blijvende opslag. Maak daarom regelmatig een back-up.', 'warning', 6000);
	}

	function openDelete() {
		deleteText = '';
		deleteOpen = true;
	}

	async function deleteAll() {
		if (!deleteConfirmed) return;
		deleting = true;
		try {
			await store.clearAll();
			applyProfile(await store.profile.get());
			deleteOpen = false;
			toasts.show('Alle gegevens zijn verwijderd', 'success');
			refreshStorage();
		} catch {
			toasts.show('Verwijderen is niet gelukt. Probeer het opnieuw.', 'error');
		} finally {
			deleting = false;
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
		return `${(bytes / (1024 * 1024)).toLocaleString('nl-NL', { maximumFractionDigits: 1 })} MB`;
	}

	function formatMoment(ms: number): string {
		return new Date(ms).toLocaleString('nl-NL', { dateStyle: 'long', timeStyle: 'short' });
	}
</script>

<svelte:head><title>Instellingen – Level Up</title></svelte:head>

<PageHeader title="Instellingen" />

{#if profile}
	<div class="sections">
		<Card as="section" class="settings-card">
			<h2>Herhalen</h2>
			<p class="muted">
				Hoeveel dagen wacht een woord voordat je het weer krijgt? Hoe hoger het bakje, hoe langer de
				pauze.
			</p>
			<form
				class="form"
				onsubmit={(event) => {
					event.preventDefault();
					saveIntervals();
				}}
			>
				<div class="intervals">
					{#each intervalInputs as _, i (i)}
						<TextField
							label={`Bakje ${i + 1}: aantal dagen`}
							type="number"
							inputmode="numeric"
							bind:value={intervalInputs[i]}
						/>
					{/each}
				</div>
				{#if intervalError}
					<p class="field-error" role="alert">
						<CircleAlert size={16} aria-hidden="true" />
						<span>{intervalError}</span>
					</p>
				{/if}
				<p class="small muted">
					Een wijziging geldt vanaf het eerstvolgende antwoord. Woorden die al ingepland zijn, houden
					hun datum.
				</p>
				<div class="buttons">
					<Button type="submit" variant="primary" disabled={!!intervalError || !intervalsChanged}>
						Opslaan
					</Button>
					<Button variant="secondary" disabled={isDefaultIntervals && !intervalsChanged} onclick={resetIntervals}>
						Standaardwaarden herstellen
					</Button>
				</div>
			</form>
		</Card>

		<Card as="section" class="settings-card">
			<h2>Nakijken</h2>
			<Toggle
				bind:checked={strictAccents}
				label="Accenten tellen mee"
				description="Aan: «cafe» in plaats van «café» telt als bijna goed. Uit: accenten worden genegeerd."
				onchange={setStrictAccents}
			/>
		</Card>

		<Card as="section" class="settings-card">
			<h2>Doelen</h2>
			<div class="field">
				<label for="weekly-goal">Weekdoel: dagen oefenen per week</label>
				<select id="weekly-goal" bind:value={weeklyGoalDays} onchange={setWeeklyGoal}>
					{#each [1, 2, 3, 4, 5, 6, 7] as n (n)}
						<option value={String(n)}>{n === 1 ? '1 dag per week' : `${n} dagen per week`}</option>
					{/each}
				</select>
			</div>
		</Card>

		<Card as="section" class="settings-card">
			<h2>Geluid en trillen</h2>
			<Toggle
				bind:checked={soundOn}
				label="Geluidseffecten"
				description="Korte geluiden bij een goed of fout antwoord, combo en een nieuw niveau."
				onchange={setSound}
			/>
			{#if canVibrate}
				<Toggle
					bind:checked={vibrationOn}
					label="Trillen bij fout antwoord"
					description="Je telefoon trilt kort als een antwoord fout is."
					onchange={setVibration}
				/>
			{/if}
		</Card>

		<Card as="section" class="settings-card">
			<h2>Weergave</h2>
			<Toggle
				bind:checked={reduceMotion}
				label="Minder beweging"
				description="Geen bewegende effecten zoals confetti en schuivende elementen."
				onchange={setReduceMotion}
			/>
		</Card>

		<Card as="section" class="settings-card">
			<h2>Gegevens en back-up</h2>
			<p class="muted">
				Je lijsten en voortgang staan alleen in deze browser op dit apparaat. Wis je de browsergegevens,
				dan is alles weg. Een back-up is je vangnet: daarmee zet je alles ook op een ander apparaat
				terug.
			</p>

			<div class="buttons">
				<Button variant="primary" loading={backupBusy} onclick={makeBackup}>
					<Download size={20} aria-hidden="true" /> Back-up maken
				</Button>
				<Button variant="secondary" onclick={() => fileInput?.click()}>
					<Upload size={20} aria-hidden="true" /> Back-up terugzetten
				</Button>
				<input
					bind:this={fileInput}
					class="file"
					type="file"
					accept="application/json,.json"
					tabindex="-1"
					aria-hidden="true"
					onchange={onFileChosen}
				/>
			</div>
			{#if backupError}
				<p class="field-error" role="alert">
					<CircleAlert size={16} aria-hidden="true" />
					<span>{backupError}</span>
				</p>
			{/if}

			<dl class="facts">
				<div>
					<dt>Laatste back-up</dt>
					<dd>{profile.lastExportAt ? formatMoment(profile.lastExportAt) : 'Nog geen back-up gemaakt'}</dd>
				</div>
				{#if storageEstimate}
					<div>
						<dt>Opslaggebruik</dt>
						<dd>{formatBytes(storageEstimate.usage)}</dd>
					</div>
				{/if}
				{#if persisted !== null}
					<div>
						<dt>Blijvende opslag</dt>
						<dd>
							{persisted
								? 'Aan: de browser wist je gegevens niet vanzelf.'
								: 'Uit: de browser kan gegevens wissen als er weinig ruimte is.'}
						</dd>
					</div>
				{/if}
			</dl>
			{#if persisted === false}
				<div><Button variant="secondary" onclick={askPersistent}>Blijvende opslag aanvragen</Button></div>
			{/if}

			<div class="danger">
				<h3>Alle gegevens verwijderen</h3>
				<p class="small muted">
					Wist alle lijsten, voortgang en instellingen van dit apparaat. Dit kun je niet ongedaan maken.
				</p>
				<div>
					<Button variant="secondary" class="danger-btn" onclick={openDelete}>
						<Trash2 size={20} aria-hidden="true" /> Alle gegevens verwijderen
					</Button>
				</div>
			</div>
		</Card>

		<Card as="section" class="settings-card">
			<h2>Over Level Up</h2>
			<ul class="plain" role="list">
				<li>Alles blijft op jouw apparaat.</li>
				<li>Je hebt geen account nodig.</li>
				<li>Er is geen tracking en er worden geen gegevens verstuurd.</li>
			</ul>
			<p class="small muted">Versie {__APP_VERSION__}</p>
		</Card>
	</div>
{:else}
	<p class="muted" role="status">Instellingen laden…</p>
{/if}

<Dialog bind:open={restoreOpen} title="Back-up terugzetten?" dismissible={!restoring} onclose={() => (pendingBackup = null)}>
	<p>
		Alle huidige gegevens worden vervangen door de inhoud van dit bestand. Dit kun je niet ongedaan
		maken. Maak eerst een back-up als je twijfelt.
	</p>
	{#snippet actions()}
		<Button variant="secondary" disabled={restoring} onclick={() => (restoreOpen = false)}>Annuleren</Button>
		<Button variant="primary" loading={restoring} onclick={restoreBackup}>Vervangen en terugzetten</Button>
	{/snippet}
</Dialog>

<Dialog bind:open={deleteOpen} title="Alle gegevens verwijderen?" dismissible={!deleting}>
	<div class="dialog-body">
		<p>
			Al je lijsten, voortgang en instellingen worden gewist. Dit kun je niet ongedaan maken. Maak
			eerst een back-up als je twijfelt.
		</p>
		<TextField
			label={`Typ «${CONFIRM_WORD}» om te bevestigen`}
			bind:value={deleteText}
			autocomplete="off"
		/>
	</div>
	{#snippet actions()}
		<Button variant="secondary" disabled={deleting} onclick={() => (deleteOpen = false)}>Annuleren</Button>
		<Button variant="primary" class="danger-btn" disabled={!deleteConfirmed} loading={deleting} onclick={deleteAll}>
			Alles verwijderen
		</Button>
	{/snippet}
</Dialog>

<style>
	.sections {
		display: grid;
		gap: var(--space-4);
	}

	:global(.settings-card) {
		display: grid;
		gap: var(--space-3);
	}

	.form {
		display: grid;
		gap: var(--space-3);
	}

	.intervals {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: var(--space-3);
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.field {
		display: grid;
		gap: var(--space-1);
	}

	.field label {
		font-weight: 600;
	}

	select {
		width: 100%;
		max-width: 320px;
		min-height: var(--touch-target);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		color: var(--color-text);
		border: 2px solid var(--color-border-strong);
		border-radius: var(--radius-m);
		font-family: var(--font-text);
		font-size: var(--text-body);
	}

	select:focus-visible {
		border-color: var(--color-energy);
	}

	.field-error {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		color: var(--color-error);
		font-size: var(--text-small);
		line-height: var(--leading-small);
	}

	.field-error :global(svg) {
		flex: none;
		margin-top: 2px;
	}

	.file {
		display: none;
	}

	.facts {
		display: grid;
		gap: var(--space-3);
		margin: 0;
	}

	.facts dt {
		font-size: var(--text-small);
		line-height: var(--leading-small);
		color: var(--color-text-muted);
	}

	.facts dd {
		margin: 0;
	}

	.danger {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-2);
		padding-top: var(--space-4);
		border-top: 1px solid var(--color-border);
	}

	.danger h3 {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: var(--text-display-m);
		line-height: var(--leading-display-m);
		color: var(--color-error);
	}

	:global(.btn.danger-btn) {
		border-color: var(--color-error);
		background: var(--color-error-tint);
		color: var(--color-text);
	}

	:global(.btn.danger-btn.v-primary) {
		background: var(--color-error);
		color: var(--color-ink);
	}

	.dialog-body {
		display: grid;
		gap: var(--space-4);
	}

	.plain {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
