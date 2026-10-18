export type ColorPair = [color, color];

/** The strafe trainer's synchronizer colors, each the top and bottom of a vertical gradient */
export const SyncColors: Readonly<Record<string, ColorPair>> = {
	EXTRA: ['rgba(24, 150, 211, 1)', 'rgba(87, 200, 255, 1)'],
	PERFECT: ['rgba(87, 200, 255, 1)', 'rgba(113, 240, 255, 1)'],
	GOOD: ['rgba(21, 152, 86, 1)', 'rgba(122, 238, 122, 1)'],
	SLOW: ['rgba(248, 222, 74, 1)', 'rgba(255, 238, 0, 1)'],
	NEUTRAL: ['rgba(178, 178, 178, 1)', 'rgba(255, 255, 255, 1)'],
	LOSS: ['rgba(220, 116, 13, 1)', 'rgba(255, 188, 0, 1)'],
	STOP: ['rgba(211, 24, 24, 1)', 'rgba(255, 87, 87, 1)']
};
