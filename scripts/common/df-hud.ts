import * as MomMath from 'util/math';
import { rgbaStringLerp, rgbaStringToRgb } from 'util/colors';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import {
	CustomizerComponentProperties,
	CustomizerPropertyType,
	registerHUDCustomizerComponent
} from 'common/hud-customizer';

export const AIR_ACCEL = 1;
export const DEFAULT_ACCEL = 2.56;
export const DEFAULT_SPEED = 320;
export const HASTE_ACCEL = 3.328; // (max speed) * (air accel = 1) * (tick interval) * (haste factor)
export const HASTE_SPEED = 416;

/** Speed of the made-up strafe the components draw while the HUD customizer is open */
export const PREVIEW_SPEED = 600;

export enum ProjectionMode {
	PERSPECTIVE = 0,
	ARC_LENGTH = 1,
	PANORAMIC = 2
}

export enum InputMode {
	NONE = 0,
	AIR_CONTROL = 1,
	STRAFE_LEFT = 2,
	STRAFE_RIGHT = 3,
	TURN_LEFT = 4,
	TURN_RIGHT = 5
}

export interface ZonePanel extends Panel {
	leftAngle: number;
	rightAngle: number;
	leftPx: number;
	rightPx: number;
	isInactive: boolean;
	color: rgbaColor;
}

export class StyleObject {
	height: number;
	color: rgbaColor;
	align: Style['verticalAlign'];

	constructor(height: number, color: rgbaColor) {
		this.height = height;
		this.align = 'center';
		this.color = color;
	}
}

/** Highlight checks the pitch and compass share with the angles component, so the numbers light up with them */
export interface DFHudHighlights {
	pitch?: (state: DefragAPI.HUDFrameState) => boolean;
	yaw?: (state: DefragAPI.HUDFrameState) => boolean;
}

/** The shared highlight checks; components each run in their own context, so they meet on the global object */
export function getDFHudHighlights(): DFHudHighlights {
	const global = UiToolkitAPI.GetGlobalObject();
	global['DFHudHighlights'] ??= {};
	return global['DFHudHighlights'] as DFHudHighlights;
}

/** Walking on slick, which turns friction off; the frame state reports no friction then */
export function isOnSlick(state: DefragAPI.HUDFrameState): boolean {
	return state.moveStatus === MomentumMovementAPI.PlayerMoveStatus.WALK && state.friction === 0;
}

export type DFHudStyle = NonNullable<CustomizerComponentProperties['dynamicStyles']>[string];

/** The 8 inputs in 45 degree steps from the view, counterclockwise (positive to the left) */
export const INPUT_NAMES = ['W', 'WA', 'A', 'SA', 'S', 'SD', 'D', 'WD'] as const;

/** VQ3 zones for single-key inputs that aren't held */
export enum SingleKeyMode {
	OFF = 'off',
	/** Only where they don't overlap a two-key zone */
	CLEAR = 'clear',
	ALWAYS = 'always'
}

/** Ways to color the zones of inputs that aren't held by their input. Components add their own modes next to these. */
export enum InputColorMode {
	/** One color for single keys and one for two-key inputs */
	KEY_COUNT = 'keyCount',
	/** A color for each of W, A, S and D, with two-key inputs blending their keys' colors */
	KEYS = 'keys',
	/** A color for each of the 8 inputs */
	DIRECTION = 'direction'
}

/** One side of the velocity to draw an input's zones on, for an input that isn't held */
export interface InputSide {
	/** Wish offset from the view, positive to the left */
	offset: number;
	bLeft: boolean;
	bTwoKey: boolean;
}

/** Size of a cell of the customizer's input color legend and the gap between cells, in layout px */
const LEGEND_CELL = 28;
const LEGEND_GAP = 2;
const LEGEND_SIZE = 3 * LEGEND_CELL + 2 * LEGEND_GAP;
/** Row and column of each input in the 3x3 legend, in INPUT_NAMES order: W on top, A on the left */
const LEGEND_CELLS = [
	[0, 1],
	[0, 0],
	[1, 0],
	[2, 0],
	[2, 1],
	[2, 2],
	[1, 2],
	[0, 2]
] as const;

/** An input's direction followed by its keys as in the legend, e.g. "Forward-Left (W+A)" */
export function inputName(input: string) {
	return `${$.Localize(`#Customizer_Df_Input_${input}`)} (${input.split('').join('+')})`;
}

/** The input color settings of a component's zones for inputs that aren't held, and its settings legend */
export class InputColors {
	/** An InputColorMode, or one of the component's own modes */
	mode: string;
	oneKeyColor: rgbaColor;
	twoKeyColor: rgbaColor;
	/** W, A, S, D colors of the KEYS mode */
	keyColors: rgbaColor[] = [];
	/** Colors of the DIRECTION mode, in INPUT_NAMES order */
	dirColors: rgbaColor[] = [];
	/** Color of each input in INPUT_NAMES order, or null when the mode doesn't color by input */
	colors: rgbaColor[] = null;
	/** Cells of the customizer's input color legend in INPUT_NAMES order, rebuilt with the settings panel */
	legendCells: Panel[] = [];

	/** Names the legend panels */
	readonly idPrefix: string;

	constructor(idPrefix: string) {
		this.idPrefix = idPrefix;
	}

	/** Works out the colors from the current settings and recolors the legend. */
	update() {
		this.colors = this.findColors();
		this.colorLegend();
	}

	/**
	 * Each input's color in INPUT_NAMES order: one or two keys, each key with two-key inputs blending their keys in
	 * HSV, or each input.
	 */
	findColors(): rgbaColor[] {
		switch (this.mode) {
			case InputColorMode.KEY_COUNT:
				return INPUT_NAMES.map((_, i) => (i % 2 ? this.twoKeyColor : this.oneKeyColor));
			case InputColorMode.KEYS:
				return INPUT_NAMES.map((_, i) => {
					const key = this.keyColors[(i >> 1) % 4];
					if (i % 2 === 0) return key;
					return rgbaStringLerp(key, this.keyColors[((i + 1) >> 1) % 4], 0.5, true) as rgbaColor;
				});
			case InputColorMode.DIRECTION:
				return [...this.dirColors];
			default:
				return null;
		}
	}

	/** Color of the input at a wish offset, or null when the mode doesn't color by input. */
	colorAt(wishOffset: number): rgbaColor | null {
		if (!this.colors) return null;
		const step = Math.round(wishOffset / (Math.PI * 0.25));
		return this.colors[((step % 8) + 8) % 8];
	}

	/** Builds the legend in its customizer settings row: W on top and A on the left, like the keys. */
	buildLegend(row: Panel) {
		// the name on top and the legend under it, since the row is too narrow for both side by side
		row.style.flowChildren = 'down';
		row.style.height = 'fit-children';
		const legend = $.CreatePanel('Panel', row, `${this.idPrefix}Legend`);
		legend.style.width = `${LEGEND_SIZE}px`;
		legend.style.height = `${LEGEND_SIZE}px`;
		legend.style.horizontalAlign = 'center';
		legend.style.margin = '4px 0px 6px 0px';

		const pitch = LEGEND_CELL + LEGEND_GAP;
		this.legendCells = INPUT_NAMES.map((input, i) => {
			const [cellRow, column] = LEGEND_CELLS[i];
			const cell = $.CreatePanel('Panel', legend, `${this.idPrefix}Legend${input}`);
			cell.style.width = `${LEGEND_CELL}px`;
			cell.style.height = `${LEGEND_CELL}px`;
			cell.style.position = `${column * pitch}px ${cellRow * pitch}px 0px`;
			cell.style.border = '1px solid rgba(0, 0, 0, 0.6)';

			const label = $.CreatePanel('Label', cell, `${this.idPrefix}LegendLabel${input}`);
			label.text = input.split('').join('+');
			label.style.horizontalAlign = 'center';
			label.style.verticalAlign = 'center';
			label.style.fontSize = '10px';
			label.style.fontWeight = 'bold';
			label.style.color = 'rgba(255, 255, 255, 1)';
			label.style.textShadow = 'rgba(0, 0, 0, 0.8) 0px 1px 2px 2.5';
			return cell;
		});
		this.colorLegend();
	}

	/** Colors the legend with the current input colors, once the settings panel has built it. */
	colorLegend() {
		if (!this.colors) return;
		this.legendCells.forEach((cell, i) => {
			if (cell.IsValid()) cell.style.backgroundColor = this.colors[i];
		});
	}
}

/** Extra properties for a style, where `tooltip` is a localization token */
type DFHudStyleExtra = { tooltip?: string } & Record<string, unknown>;

function localizeExtra({ tooltip, ...extra }: DFHudStyleExtra) {
	return tooltip ? { ...extra, tooltip: $.Localize(tooltip) } : extra;
}

/** Movement to build a made-up frame from, see DFHudComponent.previewState */
export interface PreviewMovement {
	speed: number;
	/** Radians */
	velAngle: number;
	/** Radians; ignored when wishSpeed is 0 */
	wishAngle: number;
	wishSpeed: number;
	acceleration: number;
}

/**
 * Shared base for the DF HUD components. Each component is a late-updating C++ shell (MomHudDF<Component>) whose
 * HudProcessInput runs once per rendered frame, after the view is set up, and reads everything view- and
 * movement-related from DefragAPI.GetHUDFrameState() (through getFrameState) so all components agree within a frame.
 * Settings come from the HUD customizer.
 */
export abstract class DFHudComponent {
	screenY = $.GetContextPanel().actuallayoutheight;
	screenX = $.GetContextPanel().actuallayoutwidth;
	scale = $.GetContextPanel().actualuiscale_y;
	/** Screen pixels per layout px horizontally; Panorama scales every px length by this */
	scaleX = $.GetContextPanel().actualuiscale_x;
	/** Half of the horizontal FOV (crosshair to screen edge), in radians */
	halfHFov = 0;
	/** Half of the vertical FOV (crosshair to screen edge), in radians */
	halfVFov = 0;
	projection: ProjectionMode = DefragAPI.GetHUDProjection();

	maxGroundSpeed = DEFAULT_SPEED; // changes with haste status
	snapAccel = 0;
	snapAngles: number[] = [];

	/** Whether the HUD customizer is open, so the component draws a made-up frame to be seen while placing it */
	bPreview = false;
	/** Whether the customizer settings have been applied, so there is something to draw with */
	bConfigured = false;

	constructor() {
		$.RegisterForUnhandledEvent('OnDefragHUDProjectionChange', () => {
			this.projection = DefragAPI.GetHUDProjection();
		});
		$.RegisterForUnhandledEvent('HudCustomizer_Opened', () => (this.bPreview = true));
		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => (this.bPreview = false));

		// The C++ shell only processes input while the panel is enabled (customizer toggle), in DF modes and first person
		$.RegisterEventHandler('HudProcessInput', $.GetContextPanel(), () => this.bConfigured && this.onUpdate());
	}

	abstract onUpdate(): void;

	/** Applies the current customizer settings to the panels. Runs once all settings have loaded and on every change. */
	abstract applyConfig(): void;

	/**
	 * Registers the component with the HUD customizer. Strips span the screen width and only move vertically, since
	 * everything in them is placed by its angle from the crosshair. `properties.description` is a localization token.
	 */
	registerComponent(
		name: string,
		gamemode: Gamemode | Gamemode[],
		dynamicStyles: Record<string, DFHudStyle>,
		properties: Partial<CustomizerComponentProperties> = {}
	) {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize(name),
			resizeX: false,
			resizeY: false,
			moveX: false,
			gamemode,
			dynamicStyles,
			postInit: () => {
				this.applyConfig();
				this.bConfigured = true;
			},
			...properties,
			description: properties.description && $.Localize(properties.description)
		});
	}

	numberStyle(name: string, min: number, max: number, set: (value: number) => void, extra: DFHudStyleExtra = {}) {
		return {
			name: $.Localize(name),
			type: CustomizerPropertyType.NUMBER_ENTRY,
			settingProps: { min, max },
			callbackFunc: (_: GenericPanel, value: number) => set(value),
			onChanged: () => this.applyConfig(),
			...localizeExtra(extra)
		} as DFHudStyle;
	}

	checkboxStyle(name: string, set: (value: boolean) => void, extra: DFHudStyleExtra = {}) {
		return {
			name: $.Localize(name),
			type: CustomizerPropertyType.CHECKBOX,
			callbackFunc: (_: GenericPanel, value: boolean) => set(value),
			onChanged: () => this.applyConfig(),
			...localizeExtra(extra)
		} as DFHudStyle;
	}

	colorStyle(name: string, set: (value: rgbaColor) => void, extra: DFHudStyleExtra = {}) {
		return {
			name: $.Localize(name),
			type: CustomizerPropertyType.COLOR_PICKER,
			callbackFunc: (_: GenericPanel, value: rgbaColor) => set(value),
			onChanged: () => this.applyConfig(),
			...localizeExtra(extra)
		} as DFHudStyle;
	}

	dropdownStyle(
		name: string,
		options: Array<{ label: string; value: string; gamemode?: Gamemode | Gamemode[] }>,
		set: (value: string) => void,
		extra: DFHudStyleExtra = {}
	) {
		return {
			name: $.Localize(name),
			type: CustomizerPropertyType.DROPDOWN,
			options: options.map(({ label, ...option }) => ({ ...option, label: $.Localize(label) })),
			callbackFunc: (_: GenericPanel, value: string) => set(value),
			onChanged: () => this.applyConfig(),
			...localizeExtra(extra)
		} as DFHudStyle;
	}

	groupStyle(name: string, children: string[], extra: DFHudStyleExtra = {}) {
		return {
			name: $.Localize(name),
			type: CustomizerPropertyType.NONE,
			expandable: true,
			children: children.map((styleID) => ({ styleID })),
			...localizeExtra(extra)
		} as DFHudStyle;
	}

	/**
	 * The dropdown choosing how zones of inputs that aren't held are colored, with its color pickers and legend, as
	 * style IDs `<prefix>Color`, `<prefix>Legend`, `<prefix>OneKeyColor`, `<prefix>TwoKeyColor`,
	 * `<prefix>KeyColor<W|A|S|D>` and `<prefix>DirColor<input>`. `extraOptions` are the component's own modes, listed
	 * after the shared ones.
	 */
	inputColorStyles(
		prefix: string,
		colors: InputColors,
		name: string,
		tooltip: string,
		extraOptions: Array<{ label: string; value: string }>
	): Record<string, DFHudStyle> {
		const keys = ['W', 'A', 'S', 'D'];
		const styles: Record<string, DFHudStyle> = {};
		styles[`${prefix}Color`] = this.dropdownStyle(
			name,
			[
				{ label: '#Customizer_Df_InputColor_KeyCount', value: InputColorMode.KEY_COUNT },
				{ label: '#Customizer_Df_InputColor_Keys', value: InputColorMode.KEYS },
				{ label: '#Customizer_Df_InputColor_Direction', value: InputColorMode.DIRECTION },
				...extraOptions
			],
			(value) => (colors.mode = value),
			{
				tooltip,
				children: [
					{ styleID: `${prefix}OneKeyColor`, showWhen: InputColorMode.KEY_COUNT },
					{ styleID: `${prefix}TwoKeyColor`, showWhen: InputColorMode.KEY_COUNT },
					...keys.map((key) => ({ styleID: `${prefix}KeyColor${key}`, showWhen: InputColorMode.KEYS })),
					...INPUT_NAMES.map((input) => ({
						styleID: `${prefix}DirColor${input}`,
						showWhen: InputColorMode.DIRECTION
					})),
					{
						styleID: `${prefix}Legend`,
						showWhen: [InputColorMode.KEY_COUNT, InputColorMode.KEYS, InputColorMode.DIRECTION]
					}
				]
			}
		);
		// the inputs laid out like the keys, each in its color, so the color settings can be seen together
		styles[`${prefix}Legend`] = {
			name: $.Localize('#Customizer_Df_InputColor_Preview'),
			type: CustomizerPropertyType.NONE,
			render: (row: Panel) => colors.buildLegend(row)
		} as DFHudStyle;
		styles[`${prefix}OneKeyColor`] = this.colorStyle(
			'#Customizer_Df_InputColor_OneKey',
			(value) => (colors.oneKeyColor = value)
		);
		styles[`${prefix}TwoKeyColor`] = this.colorStyle(
			'#Customizer_Df_InputColor_TwoKeys',
			(value) => (colors.twoKeyColor = value)
		);
		keys.forEach((key, i) => {
			styles[`${prefix}KeyColor${key}`] = this.colorStyle(
				inputName(key),
				(value) => (colors.keyColors[i] = value)
			);
		});
		INPUT_NAMES.forEach((input, i) => {
			styles[`${prefix}DirColor${input}`] = this.colorStyle(
				inputName(input),
				(value) => (colors.dirColors[i] = value)
			);
		});
		return styles;
	}

	/** The VQ3 Single-Key Zones dropdown. */
	singleKeyStyle(set: (value: SingleKeyMode) => void) {
		return this.dropdownStyle(
			'#Customizer_Df_SingleKeyZones',
			[
				{ label: '#Common_Off', value: SingleKeyMode.OFF },
				{ label: '#Customizer_Df_SingleKeyZones_Clear', value: SingleKeyMode.CLEAR },
				{ label: '#Customizer_Df_SingleKeyZones_Always', value: SingleKeyMode.ALWAYS }
			],
			(value) => set(value as SingleKeyMode),
			{ tooltip: '#Customizer_Df_SingleKeyZones_Tooltip', gamemode: Gamemode.DEFRAG_VQ3 }
		);
	}

	/** The VQ3 Input Range number entry in degrees, set in radians rounded to 5 degree steps. */
	inputRangeStyle(set: (value: number) => void) {
		return this.numberStyle(
			'#Customizer_Df_InputRange',
			45,
			180,
			(value) => set(MomMath.deg2rad(5 * Math.round(value / 5))),
			{
				tooltip: '#Customizer_Df_InputRange_Tooltip',
				gamemode: Gamemode.DEFRAG_VQ3,
				settingProps: { min: 45, max: 180, increment: 5 }
			}
		);
	}

	/**
	 * The inputs that aren't held to draw zones for when all 8 inputs accelerate the same way (VQ3). Each input within
	 * `range` of the velocity gets the side of the velocity its wish is on; the input nearest the velocity can strafe
	 * either way, so it gets both sides. Single keys only with a Single-Key Zones mode. The held input's sides are left
	 * out: its active side, or with `bSkipHeld` both sides.
	 */
	findVQ3InputSides(
		velFromView: number,
		range: number,
		singleKeyMode: SingleKeyMode,
		heldOffset: number | null,
		bActiveLeft: boolean,
		bSkipHeld: boolean
	): InputSide[] {
		const step = Math.PI * 0.25;
		const sides: InputSide[] = [];
		for (let i = 0; i < INPUT_NAMES.length; ++i) {
			const bTwoKey = i % 2 === 1;
			if (!bTwoKey && singleKeyMode === SingleKeyMode.OFF) continue;

			const offset = MomMath.remapAngle(i * step);
			const fromVel = MomMath.remapAngle(offset - velFromView);
			if (Math.abs(fromVel) > range + 0.001) continue;

			const bHeld = heldOffset !== null && Math.abs(MomMath.remapAngle(offset - heldOffset)) < 0.01;
			if (bHeld && bSkipHeld) continue;
			for (const bLeft of Math.abs(fromVel) <= 0.5 * step ? [true, false] : [fromVel > 0]) {
				if (bHeld && bLeft === bActiveLeft) continue;
				sides.push({ offset, bLeft, bTwoKey });
			}
		}
		return sides;
	}

	/** Sets the strip's height, which is what the customizer shows and drags. */
	setStripHeight(height: number) {
		$.GetContextPanel().style.height = Math.max(this.NaNCheck(height, 0), 1) + 'px';
	}

	/**
	 * This frame's state, or a made-up strafe on this frame's view while the customizer is open. The component is
	 * hidden while the state is invalid, so last frame's zones don't stay on screen.
	 */
	getFrameState(): DefragAPI.HUDFrameState {
		const state = DefragAPI.GetHUDFrameState();
		$.GetContextPanel().SetHasClass('dfhud--invalid', !state.valid);
		return this.bPreview && state.valid ? this.previewState(state) : state;
	}

	/**
	 * The made-up frame the customizer preview draws: a W+D air strafe at the angle of max speed gain. Components
	 * that only show for other inputs override this.
	 */
	previewState(state: DefragAPI.HUDFrameState): DefragAPI.HUDFrameState {
		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const maxSpeed = state.maxspeed > 0 ? state.maxspeed : DEFAULT_SPEED;
		const wishAngle = MomMath.remapAngle(viewAngle - Math.PI * 0.25);
		const maxAccel = AIR_ACCEL * maxSpeed * state.tickInterval;
		const velAngle = MomMath.remapAngle(wishAngle + this.findFastAngle(PREVIEW_SPEED, maxSpeed, maxAccel));
		return this.withMovement(state, {
			speed: PREVIEW_SPEED,
			velAngle,
			wishAngle,
			wishSpeed: maxSpeed,
			acceleration: AIR_ACCEL
		});
	}

	/** A copy of the frame state in the air with the given movement, derived the same way as CDFHudFrameState. */
	withMovement(state: DefragAPI.HUDFrameState, movement: PreviewMovement): DefragAPI.HUDFrameState {
		const { speed, velAngle, wishSpeed, acceleration } = movement;
		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const wishDir =
			wishSpeed > 0
				? { x: Math.cos(movement.wishAngle), y: Math.sin(movement.wishAngle), z: 0 }
				: { x: 0, y: 0, z: 0 };
		const wishAngle = wishSpeed > 0 ? movement.wishAngle : 0;

		const viewDir = { x: Math.cos(viewAngle), y: Math.sin(viewAngle) };
		const crossViewWish = viewDir.x * wishDir.y - viewDir.y * wishDir.x;
		const forwardMove = Math.round(viewDir.x * wishDir.x + viewDir.y * wishDir.y);
		const rightMove = Math.round(crossViewWish);
		const crossWishView = -crossViewWish;
		const inputMode =
			Math.round(MomMath.magnitude(wishDir)) * (1 << Math.round(2 * crossWishView * crossWishView)) +
			(Math.round(crossWishView) > 0 ? 1 : 0);
		const bAirControlPhysics = state.physicsMode !== DefragAPI.DefragPhysics.VQ3;

		return {
			...state,
			velocity: { x: speed * Math.cos(velAngle), y: speed * Math.sin(velAngle), z: 0 },
			speed,
			dropSpeed: speed,
			wishVel: { x: wishDir.x * wishSpeed, y: wishDir.y * wishSpeed, z: 0 },
			acceleration,
			friction: 0,
			maxspeed: state.maxspeed > 0 ? state.maxspeed : DEFAULT_SPEED,
			moveStatus: MomentumMovementAPI.PlayerMoveStatus.AIR,
			hasteTime: 0,
			wishDir,
			wishAngle,
			velAngle,
			forwardMove,
			rightMove,
			inputMode,
			falling: true,
			snapShift: Math.abs(forwardMove) !== Math.abs(rightMove) && !bAirControlPhysics,
			airControl:
				bAirControlPhysics && wishSpeed > 0 && Math.abs(MomMath.remapAngle(wishAngle - viewAngle)) < 0.01
		};
	}

	/** Pull this frame's screen size and FOV. */
	updateView(state: DefragAPI.HUDFrameState) {
		this.screenY = $.GetContextPanel().actuallayoutheight;
		this.screenX = $.GetContextPanel().actuallayoutwidth;
		this.scale = $.GetContextPanel().actualuiscale_y;
		this.scaleX = $.GetContextPanel().actualuiscale_x;
		this.halfHFov = MomMath.deg2rad(state.hFov) * 0.5;
		this.halfVFov = MomMath.deg2rad(state.vFov) * 0.5;
	}

	/** Update snap accel and ground speed for the current haste status, recomputing snap angles when it changes. */
	updateSnapAccel(hasteTime: number): boolean {
		const accel = hasteTime ? HASTE_ACCEL : DEFAULT_ACCEL;
		if (this.snapAccel === accel) return false;

		this.snapAccel = accel;
		this.maxGroundSpeed = hasteTime ? HASTE_SPEED : DEFAULT_SPEED;

		// find snap zone borders
		this.snapAngles = this.findSnapAngles(this.snapAccel);
		return true;
	}

	/**
	 * Maps an angle to a layout px position that lands exactly on a screen pixel. Layout px are scaled by the UI
	 * scale (1080p reference), so rounding in layout px would put edges between screen pixels at 1440p and 4K.
	 */
	mapToScreen(angle: number): number {
		return MomMath.mapAngleToScreenDist(angle, this.halfHFov, this.screenX, 1, this.projection) / this.scaleX;
	}

	/**
	 * A layout px length as a style value covering exactly the given number of whole screen pixels. Panorama rounds
	 * a panel's scaled size up to a whole pixel, so the length is pulled just under it to keep the next pixel free.
	 */
	pixelLength(length: number, uiScale: number): string {
		const pixels = Math.round(this.NaNCheck(length, 0) * uiScale);
		return pixels > 0 ? ((pixels - 0.01) / uiScale).toFixed(4) + 'px' : '0px';
	}

	/** A layout px offset as a style value landing exactly on a screen pixel. */
	pixelOffset(offset: number, uiScale: number): string {
		return (Math.round(this.NaNCheck(offset, 0) * uiScale) / uiScale).toFixed(4) + 'px';
	}

	/**
	 * Wish direction from the held keys and this frame's view: its offset from the view (positive to the left), its
	 * world angle and a unit vector. The engine's wish angle is from the last movement tick, so it lags the view while
	 * turning. With no keys held it keeps the engine's zero wish.
	 */
	findKeyWish(state: DefragAPI.HUDFrameState): { offset: number; angle: number; dir: vec2 } {
		const offset = Math.atan2(state.rightMove, state.forwardMove);
		if (!state.forwardMove && !state.rightMove) return { offset, angle: state.wishAngle, dir: state.wishDir };

		const angle = MomMath.remapAngle(MomMath.deg2rad(state.viewYaw) + offset);
		return { offset, angle, dir: { x: Math.cos(angle), y: Math.sin(angle) } };
	}

	findSlowAngle(dropSpeed: number, dropSpeedSquared: number, speedSquared: number, maxSpeed: number) {
		const threshold = Math.sqrt(Math.max(maxSpeed * maxSpeed - speedSquared + dropSpeedSquared, 0));
		return Math.acos(dropSpeed < threshold ? 1 : threshold / dropSpeed);
	}

	findFastAngle(dropSpeed: number, maxSpeed: number, maxAccel: number) {
		const threshold = maxSpeed - maxAccel;
		return Math.acos(dropSpeed < threshold ? 1 : threshold / dropSpeed);
	}

	/**
	 * Where the held input sits when all 8 inputs accelerate the same way: the travel input, the key whose direction
	 * the velocity points nearest relative to the view (W forwards, A or D sideways, S backwards), and how many 45 degree
	 * steps the held input is from it, positive to the left. One step is a strafe input and two a half-beat: travelling
	 * forwards, W+A is a strafe and A a half-beat. The velocity sits targetAngle off the held strafe input, so forwards
	 * strafing keeps it within 45 degrees of the view at any speed. CPM ground single keys pass a 45 degree travel step,
	 * so a diagonal can be the travel input there.
	 */
	findVQ3TravelSteps(
		wishOffset: number,
		velFromView: number,
		travelStep = Math.PI * 0.5
	): { travelOffset: number; steps: number } {
		const step = Math.PI * 0.25;
		const travelOffset = MomMath.remapAngle(Math.round(velFromView / travelStep) * travelStep);
		return { travelOffset, steps: Math.round(MomMath.remapAngle(wishOffset - travelOffset) / step) };
	}

	/**
	 * Wish offset of the inactive side when all 8 inputs accelerate the same way. A held strafe input mirrors across the
	 * travel input (W+A gives W+D travelling forwards), and a held half-beat gives the strafe input on the other side (A
	 * gives W+D travelling forwards), since that takes less mouse movement than the opposite half-beat (D) up to well
	 * past normal speeds. The travel input itself, or its opposite, isn't strafing, so the inactive side uses the same
	 * keys.
	 */
	findVQ3MirrorOffset(wishOffset: number, velFromView: number, travelStep = Math.PI * 0.5): number {
		const { travelOffset, steps } = this.findVQ3TravelSteps(wishOffset, velFromView, travelStep);
		if (steps === 0 || Math.abs(steps) === 4) return wishOffset;
		if (Math.abs(steps) === 2) return MomMath.remapAngle(travelOffset - Math.sign(steps) * Math.PI * 0.25);
		return MomMath.remapAngle(2 * travelOffset - wishOffset);
	}

	/**
	 * Wish offset of the CPM inactive side for a held diagonal. It mirrors across whichever of its two keys is nearer
	 * the velocity (W+A pairs with W+D around W, or with S+A around A), so the pair matches the no-key zones and the
	 * inactive side stays across the velocity.
	 */
	findCPMMirrorOffset(wishOffset: number, velFromView: number): number {
		const keyA = wishOffset - Math.PI * 0.25;
		const keyB = wishOffset + Math.PI * 0.25;
		const mirrorKey =
			Math.abs(MomMath.remapAngle(velFromView - keyA)) <= Math.abs(MomMath.remapAngle(velFromView - keyB))
				? keyA
				: keyB;
		return MomMath.remapAngle(2 * mirrorKey - wishOffset);
	}

	findTurnAngle(speed: number, dropSpeed: number, maxAccel: number, fastCgazAngle: number) {
		const threshold = speed - dropSpeed;
		return Math.max(Math.acos(maxAccel < threshold ? 1 : threshold / maxAccel), fastCgazAngle);
	}

	findStopAngle(
		maxAccel: number,
		speedSquared: number,
		dropSpeed: number,
		dropSpeedSquared: number,
		turnCgazAngle: number
	) {
		const top = speedSquared - dropSpeedSquared - maxAccel * maxAccel;
		const btm = 2 * maxAccel * dropSpeed;

		if (top >= btm) {
			return 0;
		} else if (-top >= btm) {
			return Math.PI;
		}

		return Math.max(Math.acos(btm < top ? 1 : top / btm), turnCgazAngle);
	}

	findSnapAngles(snapAccel: number): number[] {
		const singleAxisMax = Math.round(snapAccel);
		const breakPoints = this.findBreakPoints(snapAccel, singleAxisMax, []);

		const angles = breakPoints;
		const points = breakPoints.length;

		// mirror angles to fill [-Pi/2, Pi/2]
		for (let i = 0; i < points; ++i)
			angles.push(
				-breakPoints[i],
				MomMath.remapAngle(Math.PI * 0.5 - breakPoints[i]),
				MomMath.remapAngle(breakPoints[i] - Math.PI * 0.5)
			);

		return angles.sort((a, b) => a - b);
	}

	findBreakPoints(accel: number, value: number, breakPoints: number[]) {
		// get each rounding break point from the max single-axis value
		if (value > 0) {
			breakPoints.push(Math.acos((value - 0.5) / accel));
			breakPoints = this.findBreakPoints(accel, value - 1, breakPoints);
		}

		return breakPoints;
	}

	updateZone(
		zone: ZonePanel,
		left: number,
		right: number,
		offset: number,
		zoneClass: StyleObject,
		splitZone?: ZonePanel
	) {
		let wrap = right > left;

		zone.leftAngle = MomMath.remapAngle(left - offset);
		zone.rightAngle = MomMath.remapAngle(right - offset);

		wrap = zone.rightAngle > zone.leftAngle ? !wrap : wrap;

		// map angles to screen
		zone.leftPx = this.mapToScreen(zone.leftAngle);
		zone.rightPx = this.mapToScreen(zone.rightAngle);

		if (wrap && splitZone) {
			// draw second part of split zone
			this.applyClass(splitZone, zoneClass);
			splitZone.leftAngle = -this.halfHFov;
			splitZone.rightAngle = zone.rightAngle;
			splitZone.leftPx = this.mapToScreen(splitZone.leftAngle);
			splitZone.rightPx = this.mapToScreen(splitZone.rightAngle);
			this.drawZone(splitZone);

			zone.rightAngle = this.halfHFov;
			zone.rightPx = this.mapToScreen(zone.rightAngle);
		}
		this.drawZone(zone);
	}

	drawZone(zone: ZonePanel) {
		// edges are already on screen pixels, so neighbouring zones meet without a gap or an overlap
		zone.style.width = this.pixelLength(zone.rightPx - zone.leftPx, this.scaleX);

		// assign position via position (center screen at 0)
		zone.style.position = `${this.pixelOffset(zone.leftPx, this.scaleX)} 0px 0px`;
	}

	setupContainer(container: GenericPanel) {
		container.style.height = '100%';
		container.style.verticalAlign = 'center';
		container.style.overflow = 'noclip noclip';
	}

	applyClass(panel: GenericPanel, zoneClass: StyleObject) {
		panel.style.height = this.NaNCheck(zoneClass.height, 0) + 'px';
		panel.style.verticalAlign = zoneClass.align;
		panel.style.backgroundColor = zoneClass.color;
		panel.style.overflow = 'noclip noclip';
	}

	applyClassBorder(panel: GenericPanel, thickness: number, zoneClass: StyleObject) {
		panel.style.height = this.NaNCheck(zoneClass.height, 0) + 'px';
		panel.style.border = `${thickness}px solid ${zoneClass.color}`;
		panel.style.padding = `-${thickness}px`;
		panel.style.verticalAlign = zoneClass.align;
		panel.style.overflow = 'noclip noclip';
	}

	setupArrow(
		arrow: GenericPanel,
		arrowIcon: Image,
		height: number,
		width: number,
		align: Style['verticalAlign'],
		color: rgbaColor
	) {
		arrow.style.height = this.NaNCheck(height, 0) + 'px';
		arrow.style.width = this.NaNCheck(width, 0) + 'px';
		arrow.style.verticalAlign = 'center';
		arrow.style.overflow = 'noclip noclip';

		arrowIcon.style.height = this.NaNCheck(width, 0) + 'px';
		arrowIcon.style.width = this.NaNCheck(width, 0) + 'px';
		arrowIcon.style.washColor = rgbaStringToRgb(color);
		arrowIcon.style.overflow = 'noclip noclip';
		arrowIcon.style.verticalAlign = align;
	}

	clearZones(zones: ZonePanel[]) {
		for (const zone of zones) {
			zone.leftPx = 0;
			zone.rightPx = 0;
			this.drawZone(zone);
		}
	}

	NaNCheck(val: string | number, def: number): number {
		return Number.isNaN(Number(val)) ? def : (val as number);
	}

	initZonePanel(panel: Panel): ZonePanel {
		return Object.assign(panel, {
			leftAngle: 0,
			rightAngle: 0,
			leftPx: 0,
			rightPx: 0,
			isInactive: false,
			color: '' as rgbaColor
		});
	}
}
