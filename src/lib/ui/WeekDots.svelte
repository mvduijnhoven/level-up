<script module lang="ts">
	export interface WeekDay {
		/** Lokale datum als YYYY-MM-DD. */
		date: string;
		active: boolean;
		isToday: boolean;
		isFuture: boolean;
	}
</script>

<script lang="ts">
	import Check from '@lucide/svelte/icons/check';

	interface Props {
		days: WeekDay[];
		/** Zichtbare en toegankelijke titel, bijvoorbeeld "3 van 4 dagen". */
		label?: string;
	}

	let { days, label }: Props = $props();

	const narrow = new Intl.DateTimeFormat('nl-NL', { weekday: 'narrow' });
	const long = new Intl.DateTimeFormat('nl-NL', { weekday: 'long' });

	function parse(date: string): Date {
		const [y, m, d] = date.split('-').map(Number);
		return new Date(y, m - 1, d);
	}

	function status(day: WeekDay): string {
		if (day.active) return day.isToday ? 'vandaag, geoefend' : 'geoefend';
		if (day.isToday) return 'vandaag, nog niet geoefend';
		return day.isFuture ? 'nog niet aan de beurt' : 'niet geoefend';
	}
</script>

<div class="week">
	{#if label}<p class="small muted">{label}</p>{/if}
	<ul role="list" aria-label={label ?? 'Week'}>
		{#each days as day (day.date)}
			<li class:active={day.active} class:today={day.isToday} class:future={day.isFuture}>
				<span class="dot" aria-hidden="true">
					{#if day.active}<Check size={16} strokeWidth={3} />{/if}
				</span>
				<span class="letter small" aria-hidden="true">{narrow.format(parse(day.date))}</span>
				<span class="sr-only">{long.format(parse(day.date))}: {status(day)}</span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.week {
		display: grid;
		gap: var(--space-2);
	}

	ul {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		padding: 0;
		margin: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		flex: 1;
		min-width: 0;
	}

	.dot {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		border: 2px solid var(--color-border-strong);
		background: transparent;
		color: var(--color-ink);
	}

	.active .dot {
		background: var(--color-xp);
		border-color: var(--color-xp);
	}

	.today .dot {
		border-color: var(--color-energy);
		box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-energy);
	}

	.future .dot {
		border-style: dashed;
		opacity: 0.6;
	}

	.letter {
		color: var(--color-text-muted);
		text-transform: uppercase;
	}

	.today .letter {
		color: var(--color-energy);
		font-weight: 600;
	}
</style>