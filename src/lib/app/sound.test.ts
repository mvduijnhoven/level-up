import { describe, expect, it } from 'vitest';
import { playSound, vibrate } from './sound.ts';

describe('sound', () => {
	it('does not throw when audio is disabled or in node environment', () => {
		expect(() => playSound('correct', false)).not.toThrow();
		expect(() => playSound('almost', false)).not.toThrow();
		expect(() => playSound('wrong', false)).not.toThrow();
		expect(() => playSound('combo', false)).not.toThrow();
		expect(() => playSound('levelUp', false)).not.toThrow();
	});

	it('does not throw when enabled even without audio context', () => {
		expect(() => playSound('correct', true)).not.toThrow();
	});

	it('vibrate does not throw', () => {
		expect(() => vibrate(100, false)).not.toThrow();
		expect(() => vibrate([50, 50], true)).not.toThrow();
	});
});
