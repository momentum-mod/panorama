// TODO: This should be in a common file, but don't have a way to do that with TypeScript imports.
enum InputButton {
	ATTACK = 1 << 0,
	JUMP = 1 << 1,
	DUCK = 1 << 2,
	FORWARD = 1 << 3,
	BACK = 1 << 4,
	USE = 1 << 5,
	CANCEL = 1 << 6,
	LEFT = 1 << 7,
	RIGHT = 1 << 8,
	MOVELEFT = 1 << 9,
	MOVERIGHT = 1 << 10,
	ATTACK2 = 1 << 11,
	SCORE = 1 << 16,
	SPEED = 1 << 17,
	WALK = 1 << 18,
	ZOOM = 1 << 19,
	LOOKSPIN = 1 << 25,
	BHOPDISABLED = 1 << 29,
	PAINT = 1 << 30,
	STRAFE = 1 << 31
}

interface KeyPanel {
	input: InputButton;
	icon: string;
	position: { x: number; y: number };
	size?: number;
	rotate?: 0 | 90 | -90 | 180;
	alwaysVisible?: boolean;
}

const BASE_SIZE = 32;
const SCALE_FACTOR = 1.5;

const KEYS: KeyPanel[] = [
	{
		input: InputButton.FORWARD,
		icon: 'chevron-down',
		rotate: 180,
		position: { x: 32, y: 16 },
		size: 32,
		alwaysVisible: true
	},
	{
		input: InputButton.SPEED,
		icon: 'chevron-down',
		rotate: 180,
		position: { x: 36, y: 0 },
		size: 24
	},
	{
		input: InputButton.BACK,
		icon: 'chevron-down',
		rotate: 0,
		position: { x: 32, y: 48 },
		alwaysVisible: true
	},
	{
		input: InputButton.WALK,
		icon: 'chevron-down',
		rotate: 0,
		position: { x: 36, y: 72 },
		size: 24
	},
	{
		input: InputButton.MOVELEFT,
		icon: 'chevron-down',
		rotate: 90,
		position: { x: 0, y: 48 },
		size: 32,
		alwaysVisible: true
	},
	{
		input: InputButton.LEFT,
		icon: 'chevron-down',
		rotate: 90,
		position: { x: 0, y: 48 },
		size: 24
	},
	{
		input: InputButton.MOVERIGHT,
		icon: 'chevron-down',
		rotate: -90,
		position: { x: 64, y: 48 },
		size: 32,
		alwaysVisible: true
	},
	{
		input: InputButton.RIGHT,
		icon: 'chevron-down',
		rotate: -90,
		position: { x: 64, y: 48 },
		size: 24
	},
	{
		input: InputButton.JUMP,
		icon: 'jump',
		rotate: 0,
		position: { x: 20, y: 88 },
		size: 24
	},
	{
		input: InputButton.DUCK,
		icon: 'jump',
		rotate: 180,
		position: { x: 52, y: 88 },
		size: 24
	}
];

class KeyPress {
	// `state` is used to to track whether the pressed state has actually changed.
	// It's maybe premature optimisation, but saves us making multiple calls into C++ every frame,
	// which is probably the most expensive part of this component.
	static keys: Map<InputButton, { panel: Image; state: boolean }> = new Map();

	static createPanels() {
		const bounds = (axis: 'x' | 'y') =>
			(Math.max(...KEYS.map(({ position }) => position[axis])) + BASE_SIZE) * SCALE_FACTOR + 'px';
		$.GetContextPanel().style.width = bounds('x');
		$.GetContextPanel().style.height = bounds('y');

		for (const key of KEYS) {
			const size = (key.size ?? BASE_SIZE) * SCALE_FACTOR;
			const panel = $.CreatePanel('Image', $.GetContextPanel(), '', {
				src: `file://{images}/keypress/${key.icon}.svg`,
				style: `
					width: ${size}px;
					height: ${size}px;
					transform: rotatez(${key.rotate}deg)
							translatex(${key.position.x * SCALE_FACTOR}px)
							translatey(${key.position.y * SCALE_FACTOR}px);`,
				textureheight: size * 2
			});

			if (key.alwaysVisible) {
				panel.AddClass('always-visible');
			}

			this.keys.set(key.input, { panel, state: false });
		}
	}

	static onFrame() {
		// @ts-expect-error TODO: Add types!
		const buttonFlags = MomentumInputAPI.GetButtons().buttons;
		for (const [input, value] of this.keys.entries()) {
			const newState = (buttonFlags & input) !== 0;
			if (newState !== value.state) {
				value.panel.SetHasClass('pressed', newState);
				value.state = newState;
			}
		}
	}

	static {
		this.createPanels();
		$.RegisterEventHandler('HudProcessInput', $.GetContextPanel(), this.onFrame.bind(this));
	}
}
