// Web Audio API geluidseffecten voor Level Up (NF-08, design system hfd 8).
// Korte geluiden (< 0.5 s) zonder externe audiobestanden, werkt offline.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	if (!AudioContextClass) return null;
	if (!audioCtx) {
		audioCtx = new AudioContextClass();
	}
	if (audioCtx.state === 'suspended') {
		void audioCtx.resume();
	}
	return audioCtx;
}

export type SoundEffect = 'correct' | 'almost' | 'wrong' | 'combo' | 'levelUp';

export function playSound(effect: SoundEffect, enabled: boolean): void {
	if (!enabled) return;
	try {
		const ctx = getAudioContext();
		if (!ctx) return;
		const now = ctx.currentTime;

		switch (effect) {
			case 'correct': {
				// Vrolijke twee-toon (E5 -> G5, 120 ms)
				playTone(ctx, 659.25, now, 0.08, 'sine', 0.15);
				playTone(ctx, 783.99, now + 0.07, 0.12, 'sine', 0.18);
				break;
			}
			case 'almost': {
				// Warme enkele toon (A4, 150 ms)
				playTone(ctx, 440, now, 0.15, 'triangle', 0.15);
				break;
			}
			case 'wrong': {
				// Twee lage tonen (G3 -> E3, 140 ms)
				playTone(ctx, 196.0, now, 0.08, 'sawtooth', 0.12);
				playTone(ctx, 164.81, now + 0.07, 0.14, 'triangle', 0.15);
				break;
			}
			case 'combo': {
				// Snelle stijgende arpeggio (C5 -> E5 -> G5 -> C6)
				playTone(ctx, 523.25, now, 0.05, 'sine', 0.12);
				playTone(ctx, 659.25, now + 0.05, 0.05, 'sine', 0.14);
				playTone(ctx, 783.99, now + 0.1, 0.05, 'sine', 0.16);
				playTone(ctx, 1046.5, now + 0.15, 0.12, 'sine', 0.18);
				break;
			}
			case 'levelUp': {
				// Fanfare-akkoord (C5, E5, G5, C6)
				playTone(ctx, 523.25, now, 0.25, 'sine', 0.12);
				playTone(ctx, 659.25, now + 0.08, 0.25, 'sine', 0.14);
				playTone(ctx, 783.99, now + 0.16, 0.3, 'sine', 0.16);
				playTone(ctx, 1046.5, now + 0.24, 0.35, 'triangle', 0.2);
				break;
			}
		}
	} catch {
		// Audio-uitvoer mag nooit de app verstoren
	}
}

function playTone(
	ctx: AudioContext,
	freq: number,
	start: number,
	duration: number,
	type: OscillatorType,
	volume: number
): void {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();

	osc.type = type;
	osc.frequency.setValueAtTime(freq, start);

	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

	osc.connect(gain);
	gain.connect(ctx.destination);

	osc.start(start);
	osc.stop(start + duration + 0.02);
}

export function vibrate(pattern: number | number[], enabled: boolean): void {
	if (!enabled) return;
	try {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			navigator.vibrate(pattern);
		}
	} catch {
		// Trillen mag nooit een fout geven
	}
}
