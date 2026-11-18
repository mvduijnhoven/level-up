<script lang="ts">
	import { shouldReduceMotion } from './ui-settings.svelte.ts';

	interface Props {
		/** Zet op true om af te spelen en weer op false in onend. */
		active: boolean;
		durationMs?: number;
		onend?: () => void;
	}

	let { active, durationMs = 1200, onend }: Props = $props();

	let canvas = $state<HTMLCanvasElement>();
	const show = $derived(active && !shouldReduceMotion());

	const COLOR_TOKENS = ['--color-primary-light', '--color-energy', '--color-xp', '--color-boss', '--color-success'];

	interface Particle {
		x: number;
		y: number;
		vx: number;
		vy: number;
		size: number;
		rotation: number;
		spin: number;
		color: string;
	}

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const width = (canvas.width = window.innerWidth);
		const height = (canvas.height = window.innerHeight);
		const styles = getComputedStyle(document.documentElement);
		const colors = COLOR_TOKENS.map((token) => styles.getPropertyValue(token).trim());
		const particles: Particle[] = Array.from({ length: 90 }, () => ({
			x: width / 2 + (Math.random() - 0.5) * width * 0.3,
			y: height * 0.35,
			vx: (Math.random() - 0.5) * 900,
			vy: -Math.random() * 700 - 200,
			size: 6 + Math.random() * 8,
			rotation: Math.random() * Math.PI,
			spin: (Math.random() - 0.5) * 12,
			color: colors[Math.floor(Math.random() * colors.length)]
		}));

		let frame = 0;
		let last = performance.now();
		const start = last;
		let ended = false;

		const tick = (now: number) => {
			const dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			const elapsed = now - start;
			ctx.clearRect(0, 0, width, height);
			ctx.globalAlpha = Math.max(0, Math.min(1, (durationMs - elapsed) / 300));
			for (const p of particles) {
				p.vy += 1400 * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				p.rotation += p.spin * dt;
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rotation);
				ctx.fillStyle = p.color;
				ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
				ctx.restore();
			}
			if (elapsed < durationMs) {
				frame = requestAnimationFrame(tick);
			} else if (!ended) {
				ended = true;
				ctx.clearRect(0, 0, width, height);
				onend?.();
			}
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});
</script>

{#if show}
	<canvas bind:this={canvas} class="confetti" aria-hidden="true"></canvas>
{/if}

<style>
	.confetti {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: var(--z-toast);
		pointer-events: none;
	}
</style>