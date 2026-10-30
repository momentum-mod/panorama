import { PanelHandler } from 'util/module-helpers';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import * as MomMath from 'util/math';
import { rgbaStringLerp, rgbaStringToTuple, tupleToRgbaString } from 'util/colors';
import { CustomizerPropertyType } from 'common/hud-customizer';
import { DFHudComponent, DFHudStyle, InputMode, isOnSlick, StyleObject, ZonePanel } from 'common/df-hud';

enum TruenessMode {
	GROUND = 1 << 0, // show ground zones
	PROJECTED = 1 << 1, // show zones scaled by +jump/+crouch
	CPM_TURN = 1 << 2 // show a/d turn zones in the air
}

/** One side's chain of prime zones, laid out from the zone containing its target. */
interface PrimeChain {
	angles: number[];
	/** The target wrapped into the angle table's [-pi/2, pi/2] range */
	tableTarget: number;
	/** Index of the zone containing the target, from -1 to angles.length - 1 */
	first: number;
	/** The target as a view-relative angle in [-pi, pi], never wrapped to [-pi/2, pi/2] */
	target: number;
}

/** VQ3 single-key inactive zones */
enum SingleKeyMode {
	OFF = 'off',
	/** Only where they don't overlap a two-key zone */
	CLEAR = 'clear',
	ALWAYS = 'always'
}

/** z-index of the active zones; inactive zones stack below them by gain */
const ACTIVE_ZONE_Z = 1000;

enum InactiveColorMode {
	/** One color for single keys and one for two-key inputs */
	KEY_COUNT = 'keyCount',
	/** A color for each of W, A, S and D, with two-key inputs blending their keys' colors */
	KEYS = 'keys',
	/** A color for each of the 8 inputs */
	DIRECTION = 'direction',
	/** The gain or loss color, like active zones */
	GAIN = 'gain'
}

/** The 8 inputs in 45 degree steps from the view, counterclockwise (positive to the left) */
const INPUT_NAMES = ['W', 'WA', 'A', 'SA', 'S', 'SD', 'D', 'WD'] as const;

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

let HIGHLIGHT_CLASS: StyleObject;
let PRIME_SIGHT_CLASS: StyleObject;

@PanelHandler()
class DFPrimeHandler extends DFHudComponent {
	primeContainer = $('#PrimeContainer');
	primeZones: ZonePanel[] = [];
	primeInactiveZonesLeft: ZonePanel[] = [];
	primeInactiveZonesRight: ZonePanel[] = [];
	/** A second inactive chain: the same-side diagonal in CPM a/d turns */
	primeExtraZones: ZonePanel[] = [];
	primeExtraFirstZone = this.initInactiveZone('PrimeExtraFirstZone');
	primeFirstZoneLeft = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneLeft'));
	primeFirstZoneRight = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeFirstZoneRight'));
	primeHighlightZone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, 'PrimeHighlightZone'));
	primeArrow = $('#PrimeArrow');
	primeArrowIcon = $<Image>('#PrimeArrowIcon');
	primeAccel: number;
	primeAngles: number[] = [];

	primeTruenessMode: number;
	primeChain: boolean;
	primeShowInactive: boolean;
	primeSingleKeyMode: SingleKeyMode;
	/** VQ3 inactive zones show for inputs up to this far from the velocity, in radians */
	primeInactiveRange: number;
	/** First zones of the VQ3 inactive inputs, one per input side drawn this frame */
	primeVQ3FirstZones: ZonePanel[] = [];
	/** Chain panels of the VQ3 inactive inputs, a pool for each first zone */
	primeVQ3ChainZones: ZonePanel[][] = [];
	/** Cells of the customizer's input color legend in INPUT_NAMES order, rebuilt with the settings panel */
	primeLegendCells: Panel[] = [];
	primeInactiveChain: boolean;
	primeInactiveOutline: boolean;
	primeInactiveOutlineWidth: number;
	primeInactiveColorMode: InactiveColorMode;
	primeOneKeyColor: rgbaColor;
	primeTwoKeyColor: rgbaColor;
	/** W, A, S, D colors of the KEYS mode */
	primeKeyColors: rgbaColor[] = [];
	/** Colors of the DIRECTION mode, in INPUT_NAMES order */
	primeDirColors: rgbaColor[] = [];
	/** Inactive zone color for each input in INPUT_NAMES order, or null when inactive zones aren't colored by input */
	primeInputColors: rgbaColor[] = null;
	/** Wish offset of the input each of this frame's inactive zones is drawn for */
	inactiveWishOffsets = new Map<ZonePanel, number>();
	primeLockOneLine: boolean;
	primeMinSpeed: number;
	primeHeight: number;
	primeGainColor: rgbaColor;
	primeLossColor: rgbaColor;
	primeAltColor: rgbaColor;
	primeHlEnable: boolean;
	/** 0 to 1 */
	primeHlStrength: number;
	primeHlBorder: number;
	primeHlColor: rgbaColor;
	primeHeightgainEnable: boolean;
	primeColorgainEnable: boolean;
	primeArrowEnable: boolean;
	primeArrowSize: number;
	primeArrowColor: rgbaColor;
	/** Which side of the velocity the active chain is on, kept while the wish direction is on the velocity line */
	primeActiveLeft = true;

	constructor() {
		super();

		this.primeTruenessMode = 0;
		const truenessStyle = (name: string, tooltip: string, flag: TruenessMode) =>
			this.checkboxStyle(
				name,
				(value) => {
					this.primeTruenessMode = value ? this.primeTruenessMode | flag : this.primeTruenessMode & ~flag;
				},
				{ tooltip }
			);

		this.registerComponent(
			'#Customizer_Df_Prime_Name',
			// snap zones don't apply to VTG
			[Gamemode.DEFRAG_CPM, Gamemode.DEFRAG_VQ3],
			{
				minSpeed: this.numberStyle(
					'#Customizer_Df_MinSpeed',
					0,
					10000,
					(value) => (this.primeMinSpeed = value)
				),
				height: this.numberStyle('#Customizer_Height', 1, 50, (value) => (this.primeHeight = value)),
				oneLine: this.checkboxStyle(
					'#Customizer_Df_Prime_OneLine',
					(value) => (this.primeLockOneLine = value),
					{ tooltip: '#Customizer_Df_Prime_OneLine_Tooltip' }
				),
				colors: this.groupStyle('#Customizer_Colors', ['gainColor', 'lossColor', 'altColor']),
				gainColor: this.colorStyle(
					'#Customizer_Df_Snap_HighGainColor',
					(value) => (this.primeGainColor = value)
				),
				lossColor: this.colorStyle('#Customizer_Loss', (value) => (this.primeLossColor = value)),
				// the low end of color by gain, also used by inactive zones without an input or gain color
				altColor: this.colorStyle('#Customizer_Df_Snap_LowGainColor', (value) => (this.primeAltColor = value)),
				heightGain: this.checkboxStyle(
					'#Customizer_Df_HeightGain',
					(value) => (this.primeHeightgainEnable = value),
					{ tooltip: '#Customizer_Df_HeightGain_Tooltip' }
				),
				colorGain: this.checkboxStyle(
					'#Customizer_Df_ColorByGain',
					(value) => (this.primeColorgainEnable = value),
					{ tooltip: '#Customizer_Df_ColorByGain_Tooltip' }
				),
				fullChain: this.checkboxStyle('#Customizer_Df_Prime_FullChain', (value) => (this.primeChain = value), {
					tooltip: '#Customizer_Df_Prime_FullChain_Tooltip'
				}),
				inactiveEnable: this.checkboxStyle(
					'#Customizer_Df_Prime_Inactive',
					(value) => (this.primeShowInactive = value),
					{
						tooltip: '#Customizer_Df_Prime_Inactive_Tooltip',
						children: [
							{ styleID: 'inactiveSingleKey', showWhen: true },
							{ styleID: 'inactiveRange', showWhen: true },
							{ styleID: 'inactiveChain', showWhen: true },
							{ styleID: 'inactiveOutline', showWhen: true },
							{ styleID: 'inactiveColor', showWhen: true }
						]
					}
				),
				inactiveSingleKey: this.dropdownStyle(
					'#Customizer_Df_Prime_InactiveSingleKey',
					[
						{ label: '#Common_Off', value: SingleKeyMode.OFF },
						{ label: '#Customizer_Df_Prime_InactiveSingleKey_Clear', value: SingleKeyMode.CLEAR },
						{ label: '#Customizer_Df_Prime_InactiveSingleKey_Always', value: SingleKeyMode.ALWAYS }
					],
					(value) => (this.primeSingleKeyMode = value as SingleKeyMode),
					{ tooltip: '#Customizer_Df_Prime_InactiveSingleKey_Tooltip', gamemode: Gamemode.DEFRAG_VQ3 }
				),
				// in 5 degree steps
				inactiveRange: this.numberStyle(
					'#Customizer_Df_Prime_InactiveRange',
					45,
					180,
					(value) => (this.primeInactiveRange = MomMath.deg2rad(5 * Math.round(value / 5))),
					{
						tooltip: '#Customizer_Df_Prime_InactiveRange_Tooltip',
						gamemode: Gamemode.DEFRAG_VQ3,
						settingProps: { min: 45, max: 180, increment: 5 }
					}
				),
				inactiveChain: this.checkboxStyle(
					'#Customizer_Df_Prime_FullChain',
					(value) => (this.primeInactiveChain = value),
					{ tooltip: '#Customizer_Df_Prime_FullChain_Tooltip' }
				),
				inactiveOutline: this.checkboxStyle(
					'#Customizer_Df_Prime_InactiveOutline',
					(value) => (this.primeInactiveOutline = value),
					{ children: [{ styleID: 'inactiveOutlineWidth', showWhen: true }] }
				),
				inactiveOutlineWidth: this.numberStyle(
					'#Customizer_BorderWidth',
					1,
					10,
					(value) => (this.primeInactiveOutlineWidth = value)
				),
				inactiveColor: this.dropdownStyle(
					'#Customizer_Df_Prime_InactiveColorMode',
					[
						{
							label: '#Customizer_Df_Prime_InactiveColorMode_KeyCount',
							value: InactiveColorMode.KEY_COUNT
						},
						{ label: '#Customizer_Df_Prime_InactiveColorMode_Keys', value: InactiveColorMode.KEYS },
						{
							label: '#Customizer_Df_Prime_InactiveColorMode_Direction',
							value: InactiveColorMode.DIRECTION
						},
						{ label: '#Customizer_Df_Prime_InactiveColorMode_Gain', value: InactiveColorMode.GAIN }
					],
					(value) => (this.primeInactiveColorMode = value as InactiveColorMode),
					{
						tooltip: '#Customizer_Df_Prime_InactiveColorMode_Tooltip',
						children: [
							{ styleID: 'inactiveOneKeyColor', showWhen: InactiveColorMode.KEY_COUNT },
							{ styleID: 'inactiveTwoKeyColor', showWhen: InactiveColorMode.KEY_COUNT },
							...['W', 'A', 'S', 'D'].map((key) => ({
								styleID: `inactiveKeyColor${key}`,
								showWhen: InactiveColorMode.KEYS
							})),
							...INPUT_NAMES.map((input) => ({
								styleID: `inactiveDirColor${input}`,
								showWhen: InactiveColorMode.DIRECTION
							})),
							{
								styleID: 'inactiveLegend',
								showWhen: [
									InactiveColorMode.KEY_COUNT,
									InactiveColorMode.KEYS,
									InactiveColorMode.DIRECTION
								]
							}
						]
					}
				),
				// the inputs laid out like the keys, each in its color, so the color settings can be seen together
				inactiveLegend: {
					name: $.Localize('#Customizer_Df_Prime_InactiveLegend'),
					type: CustomizerPropertyType.NONE,
					render: (row: Panel) => this.buildLegend(row)
				} as DFHudStyle,
				inactiveOneKeyColor: this.colorStyle(
					'#Customizer_Df_Prime_OneKey',
					(value) => (this.primeOneKeyColor = value)
				),
				inactiveTwoKeyColor: this.colorStyle(
					'#Customizer_Df_Prime_TwoKeys',
					(value) => (this.primeTwoKeyColor = value)
				),
				...Object.fromEntries(
					['W', 'A', 'S', 'D'].map((key, i) => [
						`inactiveKeyColor${key}`,
						this.colorStyle(this.inputName(key), (value) => (this.primeKeyColors[i] = value))
					])
				),
				...Object.fromEntries(
					INPUT_NAMES.map((input, i) => [
						`inactiveDirColor${input}`,
						this.colorStyle(this.inputName(input), (value) => (this.primeDirColors[i] = value))
					])
				),
				highlightEnable: this.checkboxStyle(
					'#Customizer_Df_Highlight',
					(value) => (this.primeHlEnable = value),
					{
						tooltip: '#Customizer_Df_Prime_Highlight_Tooltip',
						children: [
							{ styleID: 'highlightStrength', showWhen: true },
							{ styleID: 'highlightBorder', showWhen: true },
							{ styleID: 'highlightColor', showWhen: true }
						]
					}
				),
				highlightStrength: this.numberStyle(
					'#Customizer_Df_Prime_HighlightStrength',
					0,
					100,
					(value) => (this.primeHlStrength = value / 100)
				),
				highlightBorder: this.numberStyle(
					'#Customizer_BorderWidth',
					0,
					10,
					(value) => (this.primeHlBorder = value)
				),
				highlightColor: this.colorStyle(
					'#Customizer_Df_HighlightColor',
					(value) => (this.primeHlColor = value)
				),
				arrowEnable: this.checkboxStyle('#Customizer_Df_Arrow', (value) => (this.primeArrowEnable = value), {
					children: [
						{ styleID: 'arrowSize', showWhen: true },
						{ styleID: 'arrowColor', showWhen: true }
					]
				}),
				arrowSize: this.numberStyle('#Customizer_Size', 1, 25, (value) => (this.primeArrowSize = value)),
				arrowColor: this.colorStyle('#Customizer_Color', (value) => (this.primeArrowColor = value)),
				trueness: this.groupStyle(
					'#Customizer_Df_Prime_Trueness',
					['truenessGround', 'truenessProjected', 'truenessCpmTurn'],
					{ tooltip: '#Customizer_Df_Prime_Trueness_Tooltip' }
				),
				truenessGround: truenessStyle(
					'#Customizer_Df_Prime_TruenessGround',
					'#Customizer_Df_Prime_TruenessGround_Tooltip',
					TruenessMode.GROUND
				),
				truenessProjected: truenessStyle(
					'#Customizer_Df_Prime_TruenessProjected',
					'#Customizer_Df_Prime_TruenessProjected_Tooltip',
					TruenessMode.PROJECTED
				),
				// VQ3 always uses the real a/d turn acceleration
				truenessCpmTurn: {
					...truenessStyle(
						'#Customizer_Df_Prime_TruenessCpmTurn',
						'#Customizer_Df_Prime_TruenessCpmTurn_Tooltip',
						TruenessMode.CPM_TURN
					),
					gamemode: Gamemode.DEFRAG_CPM
				}
			},
			{
				resizeY: true,
				heightStyle: { styleID: 'height', scale: () => this.lineCount() },
				description: '#Customizer_Df_Prime_Name_Tooltip'
			}
		);
	}

	/** Lines the strip holds: gains and losses each get one, or share one in one-line mode */
	lineCount(): number {
		return this.primeLockOneLine ? 1 : 2;
	}

	applyConfig() {
		this.primeInputColors = this.findInputColors();
		this.colorLegend();

		PRIME_SIGHT_CLASS = new StyleObject(this.primeHeight, this.primeAltColor);
		HIGHLIGHT_CLASS = new StyleObject(this.primeHeight, this.primeHlColor);

		// gains draw on the top line and losses on the bottom one, unless they share one
		const containerHeight = this.lineCount() * this.primeHeight;
		this.setStripHeight(containerHeight);
		this.setupContainer(this.primeContainer);
		for (const zone of [
			...this.primeZones,
			...this.primeInactiveZonesLeft,
			...this.primeInactiveZonesRight,
			...this.primeExtraZones,
			this.primeExtraFirstZone,
			...this.primeVQ3FirstZones,
			...this.primeVQ3ChainZones.flat()
		]) {
			this.applyClass(zone, PRIME_SIGHT_CLASS);
			zone.style.verticalAlign = 'top';
		}
		this.applyClass(this.primeFirstZoneLeft, PRIME_SIGHT_CLASS);
		this.primeFirstZoneLeft.style.verticalAlign = 'top';
		this.applyClass(this.primeFirstZoneRight, PRIME_SIGHT_CLASS);
		this.primeFirstZoneRight.style.verticalAlign = 'top';

		this.applyClassBorder(this.primeHighlightZone, this.primeHlBorder, HIGHLIGHT_CLASS);
		this.primeHighlightZone.style.verticalAlign = 'top';
		this.primeHighlightZone.style.zIndex = ACTIVE_ZONE_Z + 1;

		const width = 2 * this.primeArrowSize;
		const height = containerHeight + 2 * width;
		this.setupArrow(this.primeArrow, this.primeArrowIcon, height, width, 'top', this.primeArrowColor);
		if (!this.primeArrowEnable) this.primeArrow.visible = false;
	}

	/** An input's direction followed by its keys as in the legend, e.g. "Forward-Left (W+A)" */
	inputName(input: string) {
		return `${$.Localize(`#Customizer_Df_Prime_Input_${input}`)} (${input.split('').join('+')})`;
	}

	/** Builds the input color legend in its customizer settings row: W on top and A on the left, like the keys. */
	buildLegend(row: Panel) {
		// the name on top and the legend under it, since the row is too narrow for both side by side
		row.style.flowChildren = 'down';
		row.style.height = 'fit-children';
		const legend = $.CreatePanel('Panel', row, 'PrimeLegend');
		legend.style.width = `${LEGEND_SIZE}px`;
		legend.style.height = `${LEGEND_SIZE}px`;
		legend.style.horizontalAlign = 'center';
		legend.style.margin = '4px 0px 6px 0px';

		const pitch = LEGEND_CELL + LEGEND_GAP;
		this.primeLegendCells = INPUT_NAMES.map((input, i) => {
			const [cellRow, column] = LEGEND_CELLS[i];
			const cell = $.CreatePanel('Panel', legend, `PrimeLegend${input}`);
			cell.style.width = `${LEGEND_CELL}px`;
			cell.style.height = `${LEGEND_CELL}px`;
			cell.style.position = `${column * pitch}px ${cellRow * pitch}px 0px`;
			cell.style.border = '1px solid rgba(0, 0, 0, 0.6)';

			const label = $.CreatePanel('Label', cell, `PrimeLegendLabel${input}`);
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
		if (!this.primeInputColors) return;
		this.primeLegendCells.forEach((cell, i) => {
			if (cell.IsValid()) cell.style.backgroundColor = this.primeInputColors[i];
		});
	}

	onUpdate() {
		const state = this.getFrameState();
		if (!state.valid) return;

		// clear last frame's special zones
		this.clearZones([
			this.primeFirstZoneLeft,
			this.primeFirstZoneRight,
			this.primeHighlightZone,
			this.primeExtraFirstZone
		]);

		this.updateView(state);
		this.updateSnapAccel(state.hasteTime);

		const phyMode = state.physicsMode;
		const tickInterval = state.tickInterval;
		const speed = state.speed;
		const dropSpeed = state.dropSpeed;
		const speedSquared = speed * speed;
		const dropSpeedSquared = dropSpeed * dropSpeed;

		const velAngle = state.velAngle;
		const { angle: wishAngle, dir: wishDir } = this.findKeyWish(state);
		const viewAngle = MomMath.deg2rad(state.viewYaw);
		const viewDir = {
			x: Math.cos(viewAngle),
			y: Math.sin(viewAngle)
		};

		this.clearZones(this.primeZones);
		this.clearZones(this.primeInactiveZonesLeft);
		this.clearZones(this.primeInactiveZonesRight);
		this.clearZones(this.primeExtraZones);
		this.clearZones(this.primeVQ3FirstZones);
		for (const pool of this.primeVQ3ChainZones) this.clearZones(pool);

		if (phyMode !== DefragAPI.DefragPhysics.VTG && speed > this.primeMinSpeed) {
			// the real acceleration gives ground zones on the ground (GROUND) and a/d turn zones in the air (CPM_TURN,
			// always in VQ3); otherwise the zones use the air strafe acceleration. VQ3 slick accelerates the same way
			// as VQ3 air, so it gets the air zones whatever GROUND is set to
			const bAirAccel = state.falling || (phyMode === DefragAPI.DefragPhysics.VQ3 && isOnSlick(state));
			const useSnapAccel = bAirAccel
				? !(this.primeTruenessMode & TruenessMode.CPM_TURN || phyMode === DefragAPI.DefragPhysics.VQ3)
				: !(this.primeTruenessMode & TruenessMode.GROUND);
			// PROJECTED scales the zones by how much +jump/+crouch cut the wish speed below the max speed, for the air
			// strafe zones as well as the real ones. With no keys held the wish velocity is zero, which would push the
			// targets out to 90 degrees; leave those unscaled so the inactive zones sit where a key press would put them
			const wishSpeed = MomMath.magnitude(state.wishVel);
			const projectedScale =
				this.primeTruenessMode & TruenessMode.PROJECTED && wishSpeed > 0 && state.maxspeed > 0
					? Math.min(wishSpeed / state.maxspeed, 1)
					: 1;
			const primeMaxSpeed = state.maxspeed * projectedScale;
			const primeMaxAccel = state.acceleration * primeMaxSpeed * tickInterval;
			const primeSightSpeed = useSnapAccel ? this.maxGroundSpeed * projectedScale : primeMaxSpeed;
			const primeSightAccel = useSnapAccel ? this.snapAccel * projectedScale : primeMaxAccel;

			if (this.primeAccel !== primeSightAccel) {
				this.primeAccel = primeSightAccel;

				this.primeAngles = this.findSnapAngles(primeSightAccel);
			}

			// the pool only grows, so takeoffs and landings, whose angle tables differ in size, don't recreate panels
			while (this.primeZones.length < this.primeAngles.length)
				this.primeZones.push(this.initPrimeZone(`PrimeZone${this.primeZones.length}`));

			const targetAngle = this.findFastAngle(dropSpeed, primeSightSpeed, primeSightAccel);
			// the air strafe target, for the a/d turn chains drawn with the air strafe angles
			const strafeTargetAngle = this.findFastAngle(
				dropSpeed,
				this.maxGroundSpeed * projectedScale,
				this.snapAccel * projectedScale
			);
			const boundaryAngle = this.findStopAngle(
				primeSightAccel,
				speedSquared,
				dropSpeed,
				dropSpeedSquared,
				targetAngle
			);
			this.updatePrimeSight(state, viewDir, viewAngle, targetAngle, strafeTargetAngle, boundaryAngle, velAngle);

			if (this.primeArrowEnable) {
				if (MomMath.sumOfSquares2D(wishDir) > 0) {
					let arrowAngle =
						wishAngle -
						Math.atan2(Math.round(this.primeAccel * wishDir.y), Math.round(this.primeAccel * wishDir.x));
					// outside the view, point the opposite way, like the compass arrow
					if (!(Math.abs(arrowAngle) < this.halfHFov)) {
						arrowAngle = MomMath.remapAngle(arrowAngle + Math.PI);
					}
					const leftEdge = this.mapToScreen(arrowAngle) - this.primeArrowSize;
					this.primeArrow.style.position = `${this.NaNCheck(leftEdge, 0)}px 0px 0px`;
					this.primeArrow.visible = true;
				} else {
					this.primeArrow.visible = false;
				}
			}
		} else {
			this.primeArrow.visible = false;
		}
	}

	updatePrimeSight(
		state: DefragAPI.HUDFrameState,
		viewDir: vec2,
		viewAngle: number,
		targetAngle: number,
		strafeTargetAngle: number,
		boundaryAngle: number,
		velAngle: number
	) {
		const inputMode = state.inputMode;
		const velocity = state.velocity;
		const gainZonesMap = new Map<ZonePanel, number>();
		this.inactiveWishOffsets.clear();
		const phyMode = state.physicsMode;

		let speedGain = 0;
		let gainMax = -this.primeAccel;
		let leftTarget = -targetAngle - velAngle;
		let rightTarget = targetAngle - velAngle;

		// Wish direction relative to the view, positive to the left. Strafe keys put it 45 degrees off the view
		// axis when moving forward (W+A, W+D) and 135 degrees off when moving backward (S+A, S+D).
		const wishOffset = this.findKeyWish(state).offset;
		const strafeOffset = Math.PI * (Math.cos(velAngle - viewAngle) >= 0 ? 0.25 : 0.75);
		const velFromView = MomMath.remapAngle(velAngle - viewAngle);
		const bVQ3 = phyMode === DefragAPI.DefragPhysics.VQ3;

		// With no keys held, the zones use the two diagonals around the key nearest the velocity relative to the view:
		// W+A/W+D when it points forwards, S+A/S+D backwards, W+A/S+A to the left and W+D/S+D to the right. The left
		// chain takes the diagonal 45 degrees left of that key, so it stays on the left of the velocity.
		const nearestKeyOffset = Math.round(velFromView / (Math.PI * 0.5)) * Math.PI * 0.5;
		let leftWishOffset = MomMath.remapAngle(nearestKeyOffset + Math.PI * 0.25);
		let rightWishOffset = MomMath.remapAngle(nearestKeyOffset - Math.PI * 0.25);
		let bFill = false;
		// W or S alone is air control in CPM, but VQ3 accelerates the same way in every direction
		const bForwardOnly = inputMode === InputMode.AIR_CONTROL && bVQ3;

		if (inputMode === InputMode.STRAFE_LEFT || inputMode === InputMode.STRAFE_RIGHT || bForwardOnly) {
			bFill = true;
		} else if (inputMode === InputMode.TURN_LEFT || inputMode === InputMode.TURN_RIGHT) {
			bFill = Boolean(this.primeTruenessMode & TruenessMode.CPM_TURN || bVQ3);
		}

		// The active chain is on whichever side of the velocity the wish direction is
		const wishFromVel = MomMath.remapAngle(viewAngle + wishOffset - velAngle);
		if (
			(state.forwardMove || state.rightMove) &&
			Math.abs(wishFromVel) > 0.01 &&
			Math.abs(wishFromVel) < Math.PI - 0.01
		) {
			this.primeActiveLeft = wishFromVel > 0;
		}

		const bTurn = inputMode === InputMode.TURN_LEFT || inputMode === InputMode.TURN_RIGHT;
		if (bFill || bTurn) {
			// the active side uses the actual wish direction (or its strafe equivalent when a turn isn't filled),
			// and in CPM the inactive side mirrors it across the velocity (A/D turns mirror to the strafe diagonal on
			// the other side). VQ3 draws its inactive zones per input instead, see drawVQ3InactiveZones
			const sideSign = Math.sign(wishOffset);
			const activeOffset = bFill ? wishOffset : sideSign * strafeOffset;
			let inactiveOffset = activeOffset;
			if (!bVQ3) {
				inactiveOffset = bTurn ? -sideSign * strafeOffset : this.findCPMMirrorOffset(wishOffset, velFromView);
			}
			if (this.primeActiveLeft) {
				leftWishOffset = activeOffset;
				rightWishOffset = inactiveOffset;
			} else {
				leftWishOffset = inactiveOffset;
				rightWishOffset = activeOffset;
			}
		}

		// CPM a/d turns mirror to an air strafe diagonal, so that side uses the air strafe target. VQ3 inputs all
		// accelerate the same way, so both sides use the same target.
		if (bTurn && !bVQ3) {
			if (this.primeActiveLeft) rightTarget = strafeTargetAngle - velAngle;
			else leftTarget = -strafeTargetAngle - velAngle;
		}

		const fillLeftZones = bFill && this.primeActiveLeft;
		const fillRightZones = bFill && !this.primeActiveLeft;
		const leftOffset = -leftWishOffset - viewAngle;
		const rightOffset = -rightWishOffset - viewAngle;
		const leftWishDir = MomMath.rotateVector2D(viewDir, leftWishOffset);
		const rightWishDir = MomMath.rotateVector2D(viewDir, rightWishOffset);

		const leftAngles = fillLeftZones ? this.primeAngles : this.snapAngles;
		const rightAngles = fillRightZones ? this.primeAngles : this.snapAngles;

		const leftChain = this.findPrimeChain(leftTarget, leftOffset, leftAngles);
		const rightChain = this.findPrimeChain(rightTarget, rightOffset, rightAngles);

		// first zones are drawn from the target outward, but their gain uses the whole zone. VQ3 has no mirrored side
		const bShowMirror = this.primeShowInactive && !bVQ3;
		const [firstLeftEdge, firstLeftEnd] = this.primeZoneEdges(leftChain, leftChain.first);
		if (fillLeftZones || bShowMirror) {
			this.drawPrimeZone(this.primeFirstZoneLeft, firstLeftEdge, leftChain.target);
			this.primeFirstZoneLeft.isInactive = !fillLeftZones;
			this.inactiveWishOffsets.set(this.primeFirstZoneLeft, leftWishOffset);
		} else {
			this.clearZones([this.primeFirstZoneLeft]);
		}

		// both first zones count toward the height scale, so diagonal strafing shows which side has more gain;
		// CPM a/d turn zones scale by their own gain, since the mirrored strafe side's would always dwarf them
		const bTurnScaleOnly = bTurn && bFill && !bVQ3;
		if (fillLeftZones || !bVQ3) {
			speedGain = this.findPrimeGain(0.5 * (firstLeftEdge + firstLeftEnd), velocity, leftWishDir);
			gainZonesMap.set(this.primeFirstZoneLeft, speedGain);
			if ((fillLeftZones || !bTurnScaleOnly) && speedGain > gainMax) gainMax = speedGain;
		}

		const [firstRightStart, firstRightEdge] = this.primeZoneEdges(rightChain, rightChain.first);
		if (fillRightZones || bShowMirror) {
			this.drawPrimeZone(this.primeFirstZoneRight, rightChain.target, firstRightEdge);
			this.primeFirstZoneRight.isInactive = !fillRightZones;
			this.inactiveWishOffsets.set(this.primeFirstZoneRight, rightWishOffset);
		} else {
			this.clearZones([this.primeFirstZoneRight]);
		}

		if (fillRightZones || !bVQ3) {
			speedGain = this.findPrimeGain(0.5 * (firstRightStart + firstRightEdge), velocity, rightWishDir);
			gainZonesMap.set(this.primeFirstZoneRight, speedGain);
			if ((fillRightZones || !bTurnScaleOnly) && speedGain > gainMax) gainMax = speedGain;
		}

		if (fillLeftZones && this.primeChain) {
			const leftBoundary = leftChain.target - (boundaryAngle - targetAngle);
			gainMax = this.fillPrimeZones(
				leftChain,
				-1,
				leftBoundary,
				this.primeZones,
				gainZonesMap,
				gainMax,
				velocity,
				leftWishDir
			);
		}

		if (fillRightZones && this.primeChain) {
			const rightBoundary = rightChain.target + (boundaryAngle - targetAngle);
			gainMax = this.fillPrimeZones(
				rightChain,
				1,
				rightBoundary,
				this.primeZones,
				gainZonesMap,
				gainMax,
				velocity,
				rightWishDir
			);
		}

		// inactive sides always draw their first zone (above); the rest of their chain is optional
		if (bShowMirror && this.primeInactiveChain) {
			const boundaryDistance = boundaryAngle - targetAngle;
			if (!fillLeftZones) {
				this.fillInactiveChain(
					leftChain,
					-1,
					leftChain.target - boundaryDistance,
					this.primeInactiveZonesLeft,
					'PrimeInactiveZoneLeft',
					gainZonesMap,
					velocity,
					leftWishDir,
					leftWishOffset
				);
			}
			if (!fillRightZones) {
				this.fillInactiveChain(
					rightChain,
					1,
					rightChain.target + boundaryDistance,
					this.primeInactiveZonesRight,
					'PrimeInactiveZoneRight',
					gainZonesMap,
					velocity,
					rightWishDir,
					rightWishOffset
				);
			}
		}

		if (bVQ3 && this.primeShowInactive) {
			gainMax = this.drawVQ3InactiveZones(
				viewDir,
				viewAngle,
				velAngle,
				velFromView,
				targetAngle,
				boundaryAngle,
				velocity,
				bFill ? wishOffset : null,
				gainZonesMap,
				gainMax
			);
		}

		// CPM a/d turns: the inactive side shows the opposite diagonal (W+D while holding A), so also show the
		// same-side diagonal (W+A) as inactive zones; either can have more gain depending on the velocity.
		if (bTurnScaleOnly && this.primeShowInactive) {
			const sameWishOffset = Math.sign(wishOffset) * strafeOffset;
			const sameWishDir = MomMath.rotateVector2D(viewDir, sameWishOffset);
			const bLeft = MomMath.remapAngle(viewAngle + sameWishOffset - velAngle) > 0;
			const sameChain = this.findPrimeChain(
				bLeft ? -strafeTargetAngle - velAngle : strafeTargetAngle - velAngle,
				-sameWishOffset - viewAngle,
				this.snapAngles
			);
			const direction = bLeft ? -1 : 1;

			const [firstStart, firstEnd] = this.primeZoneEdges(sameChain, sameChain.first);
			if (bLeft) this.drawPrimeZone(this.primeExtraFirstZone, firstStart, sameChain.target);
			else this.drawPrimeZone(this.primeExtraFirstZone, sameChain.target, firstEnd);
			gainZonesMap.set(
				this.primeExtraFirstZone,
				this.findPrimeGain(0.5 * (firstStart + firstEnd), velocity, sameWishDir)
			);
			this.inactiveWishOffsets.set(this.primeExtraFirstZone, sameWishOffset);

			if (this.primeInactiveChain) {
				this.fillInactiveChain(
					sameChain,
					direction,
					sameChain.target + direction * (boundaryAngle - targetAngle),
					this.primeExtraZones,
					'PrimeExtraZone',
					gainZonesMap,
					velocity,
					sameWishDir,
					sameWishOffset
				);
			}
		}

		// heights are worked out in screen pixels, so every zone meets the center line on the same pixel row
		const uiScale = this.scale;
		const linePixels = Math.round(this.primeHeight * uiScale);
		const scale = this.NaNCheck(1 / (gainMax > 0 ? gainMax : this.primeAccel), 1);
		// in CPM a/d turns the inactive zones (both diagonals) scale by their own best gain, like the turn zones do
		let inactiveScale = scale;
		if (bTurnScaleOnly) {
			let inactiveGainMax = 0;
			for (const [zone, gain] of gainZonesMap.entries()) {
				if (zone.isInactive && gain > inactiveGainMax) inactiveGainMax = gain;
			}
			inactiveScale = this.NaNCheck(1 / (inactiveGainMax > 0 ? inactiveGainMax : this.primeAccel), 1);
		}
		// overlapping inactive zones show the one with more gain on top, and active zones above them all
		const inactiveByGain = [...gainZonesMap.entries()]
			.filter(([zone]) => zone.isInactive)
			.sort(([, a], [, b]) => a - b)
			.map(([zone]) => zone);
		for (const [i, zone] of inactiveByGain.entries()) zone.style.zIndex = i + 1;

		for (const [zone, gain] of gainZonesMap.entries()) {
			const zoneScale = zone.isInactive ? inactiveScale : scale;
			const gainFactor = this.NaNCheck(Math.min(Math.abs(gain * zoneScale), 1), 1);
			const secondLine = gain < 0 && !this.primeLockOneLine;
			const height = this.NaNCheck(this.primeHeight * (this.primeHeightgainEnable ? gainFactor : 1), 0);
			const heightPixels = Math.min(Math.round(height * uiScale), linePixels);
			const marginPixels = secondLine ? linePixels : linePixels - heightPixels;
			zone.style.height = this.pixelLength(heightPixels / uiScale, uiScale);
			zone.style.marginTop = this.pixelOffset(marginPixels / uiScale, uiScale);
			zone.style.marginBottom = this.pixelOffset(
				(secondLine ? linePixels - heightPixels : (this.lineCount() - 1) * linePixels) / uiScale,
				uiScale
			);

			if (zone.isInactive) {
				this.styleInactiveZone(zone, this.findInactiveColor(zone, gain, gainFactor));
				continue;
			}

			zone.color = this.findGainColor(gain, gainFactor);
			zone.style.zIndex = ACTIVE_ZONE_Z;

			// first zones switch between active and inactive, so drop any inactive outline
			if (zone === this.primeFirstZoneLeft || zone === this.primeFirstZoneRight) {
				zone.style.border = '0px solid rgba(0, 0, 0, 0)';
				zone.style.padding = '0px';
			}

			if (this.primeHlEnable && this.shouldHighlight(zone)) {
				this.zoneCopy(this.primeHighlightZone, zone);
				this.drawZone(this.primeHighlightZone);
				this.primeHighlightZone.style.height = this.pixelLength(linePixels / uiScale, uiScale);
				this.primeHighlightZone.style.marginTop = this.pixelOffset(
					(secondLine ? linePixels : 0) / uiScale,
					uiScale
				);

				const [r, g, b, a = 255] = rgbaStringToTuple(zone.color);
				zone.color = tupleToRgbaString([r, g, b, MomMath.lerp(a, 255, this.primeHlStrength)]);
			}

			zone.style.backgroundColor = zone.color;
		}
	}

	/**
	 * VQ3 inactive zones. Every input accelerates the same way in VQ3, so each input within the Input Range of the
	 * velocity gets the zones on the side of the velocity its wish is on, except the held input's active side; the
	 * input nearest the velocity can strafe either way, so it gets both sides. Two-key inputs always show. Single keys
	 * show with the Single-Key Zones option, and with No Overlap only the zones that don't overlap a two-key zone,
	 * active or not. The first zones count toward the height scale like the mirrored side does in CPM. Returns the new
	 * gainMax.
	 */
	drawVQ3InactiveZones(
		viewDir: vec2,
		viewAngle: number,
		velAngle: number,
		velFromView: number,
		targetAngle: number,
		boundaryAngle: number,
		velocity: vec3,
		heldOffset: number | null,
		gainZonesMap: Map<ZonePanel, number>,
		gainMax: number
	): number {
		const step = Math.PI * 0.25;
		const singleKeyZones: ZonePanel[] = [];
		const twoKeyZones: ZonePanel[] = [];
		const firstZones: ZonePanel[] = [];
		let slot = 0;

		for (let i = 0; i < INPUT_NAMES.length; ++i) {
			const bTwoKey = i % 2 === 1;
			if (!bTwoKey && this.primeSingleKeyMode === SingleKeyMode.OFF) continue;

			const offset = MomMath.remapAngle(i * step);
			const fromVel = MomMath.remapAngle(offset - velFromView);
			if (Math.abs(fromVel) > this.primeInactiveRange + 0.001) continue;

			const sides = Math.abs(fromVel) <= 0.5 * step ? [true, false] : [fromVel > 0];
			const bHeld = heldOffset !== null && Math.abs(MomMath.remapAngle(offset - heldOffset)) < 0.01;
			for (const bLeft of sides) {
				if (bHeld && bLeft === this.primeActiveLeft) continue;

				const zones = this.drawVQ3InactiveInput(
					slot++,
					offset,
					bLeft,
					viewDir,
					viewAngle,
					velAngle,
					targetAngle,
					boundaryAngle,
					velocity,
					gainZonesMap
				);
				firstZones.push(zones[0]);
				(bTwoKey ? twoKeyZones : singleKeyZones).push(...zones);
			}
		}

		if (this.primeSingleKeyMode === SingleKeyMode.CLEAR) {
			// a held two-key input's zones count too
			if (heldOffset !== null && Math.round(heldOffset / step) % 2 !== 0) {
				for (const zone of gainZonesMap.keys()) if (!zone.isInactive) twoKeyZones.push(zone);
			}
			const overlaps = (a: ZonePanel, b: ZonePanel) => a.leftPx < b.rightPx && b.leftPx < a.rightPx;
			for (const zone of singleKeyZones) {
				if (twoKeyZones.some((other) => overlaps(zone, other))) {
					this.clearZones([zone]);
					gainZonesMap.delete(zone);
				}
			}
		}

		for (const zone of firstZones) {
			const gain = gainZonesMap.get(zone);
			if (gain !== undefined && gain > gainMax) gainMax = gain;
		}
		return gainMax;
	}

	/** Draws one VQ3 inactive input's first zone, and its chain with Full Chain on. Returns the zones drawn. */
	drawVQ3InactiveInput(
		slot: number,
		offset: number,
		bLeft: boolean,
		viewDir: vec2,
		viewAngle: number,
		velAngle: number,
		targetAngle: number,
		boundaryAngle: number,
		velocity: vec3,
		gainZonesMap: Map<ZonePanel, number>
	): ZonePanel[] {
		// panels only grow, like the other pools
		while (this.primeVQ3FirstZones.length <= slot) {
			const index = this.primeVQ3FirstZones.length;
			this.primeVQ3FirstZones.push(this.initInactiveZone(`PrimeVQ3FirstZone${index}`));
			this.primeVQ3ChainZones.push([]);
		}
		const firstZone = this.primeVQ3FirstZones[slot];
		const wishDir = MomMath.rotateVector2D(viewDir, offset);
		const chain = this.findPrimeChain(
			bLeft ? -targetAngle - velAngle : targetAngle - velAngle,
			-offset - viewAngle,
			this.primeAngles
		);

		const [firstStart, firstEnd] = this.primeZoneEdges(chain, chain.first);
		if (bLeft) this.drawPrimeZone(firstZone, firstStart, chain.target);
		else this.drawPrimeZone(firstZone, chain.target, firstEnd);
		gainZonesMap.set(firstZone, this.findPrimeGain(0.5 * (firstStart + firstEnd), velocity, wishDir));
		this.inactiveWishOffsets.set(firstZone, offset);
		if (!this.primeInactiveChain) return [firstZone];

		const direction = bLeft ? -1 : 1;
		const pool = this.primeVQ3ChainZones[slot];
		this.fillInactiveChain(
			chain,
			direction,
			chain.target + direction * (boundaryAngle - targetAngle),
			pool,
			`PrimeVQ3Zone${slot}_`,
			gainZonesMap,
			velocity,
			wishDir,
			offset
		);
		return [firstZone, ...pool.filter((zone) => gainZonesMap.has(zone))];
	}

	/** Zone color for a gain: loss color, or high-gain color (blended from the low-gain color when coloring by gain). */
	findGainColor(gain: number, gainFactor: number): rgbaColor {
		if (gain < 0) return this.primeLossColor;
		if (this.primeColorgainEnable)
			return rgbaStringLerp(this.primeAltColor, this.primeGainColor, gainFactor) as rgbaColor;
		return this.primeGainColor;
	}

	/**
	 * Inactive zone colors for each input in the input color modes, in INPUT_NAMES order: one or two keys, each key with
	 * two-key inputs blending their keys in HSV, or each input. Null in the other modes.
	 */
	findInputColors(): rgbaColor[] {
		switch (this.primeInactiveColorMode) {
			case InactiveColorMode.KEY_COUNT:
				return INPUT_NAMES.map((_, i) => (i % 2 ? this.primeTwoKeyColor : this.primeOneKeyColor));
			case InactiveColorMode.KEYS:
				return INPUT_NAMES.map((_, i) => {
					const key = this.primeKeyColors[(i >> 1) % 4];
					if (i % 2 === 0) return key;
					return rgbaStringLerp(key, this.primeKeyColors[((i + 1) >> 1) % 4], 0.5, true) as rgbaColor;
				});
			case InactiveColorMode.DIRECTION:
				return [...this.primeDirColors];
			default:
				return null;
		}
	}

	/** Color of an inactive zone: its input's color, or the gain color by gain. Falls back to the low-gain color. */
	findInactiveColor(zone: ZonePanel, gain: number, gainFactor: number): rgbaColor {
		if (this.primeInactiveColorMode === InactiveColorMode.GAIN) return this.findGainColor(gain, gainFactor);

		const wishOffset = this.inactiveWishOffsets.get(zone);
		if (!this.primeInputColors || wishOffset === undefined) return this.primeAltColor;

		const step = Math.round(wishOffset / (Math.PI * 0.25));
		return this.primeInputColors[((step % 8) + 8) % 8];
	}

	/** Inactive and half-beat zones are either filled or outlined with the given color. */
	styleInactiveZone(zone: ZonePanel, color: rgbaColor) {
		const border = this.primeInactiveOutline ? this.primeInactiveOutlineWidth : 0;
		zone.style.backgroundColor = this.primeInactiveOutline ? 'rgba(0, 0, 0, 0)' : color;
		zone.style.border = `${border}px solid ${color}`;
		zone.style.padding = border ? `-${border}px` : '0px';
	}

	/** Creates a panel for the active chains. Zones are never deleted: ones past the angle table stay cleared. */
	initPrimeZone(id: string): ZonePanel {
		const zone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, id));
		zone.color = this.primeAltColor; // used for highlight
		if (PRIME_SIGHT_CLASS) this.applyClass(zone, PRIME_SIGHT_CLASS);
		zone.style.verticalAlign = 'top';
		return zone;
	}

	/** Creates a panel for an inactive or half-beat chain. */
	initInactiveZone(id: string): ZonePanel {
		const zone = this.initZonePanel($.CreatePanel('Panel', this.primeContainer, id));
		zone.isInactive = true;
		if (PRIME_SIGHT_CLASS) this.applyClass(zone, PRIME_SIGHT_CLASS);
		zone.style.verticalAlign = 'top';
		return zone;
	}

	/**
	 * Fills an inactive or half-beat chain for the input at a wish offset. Its gains stay out of gainMax so they don't
	 * rescale the active chain, and its panel pool grows to the chain's angle table.
	 */
	fillInactiveChain(
		chain: PrimeChain,
		direction: number,
		boundary: number,
		pool: ZonePanel[],
		idPrefix: string,
		gainZonesMap: Map<ZonePanel, number>,
		velocity: vec3,
		wishDir: vec2,
		wishOffset: number
	) {
		while (pool.length < chain.angles.length) pool.push(this.initInactiveZone(`${idPrefix}${pool.length}`));
		this.fillPrimeZones(chain, direction, boundary, pool, gainZonesMap, 0, velocity, wishDir);
		for (const zone of pool) if (gainZonesMap.has(zone)) this.inactiveWishOffsets.set(zone, wishOffset);
	}

	/**
	 * Finds where a chain starts. The angle table covers [-pi/2, pi/2] and repeats every pi, but the chain is laid
	 * out from its view-relative target in [-pi, pi], so its zones keep their real directions and never wrap.
	 */
	findPrimeChain(target: number, offset: number, angles: number[]): PrimeChain {
		const tableTarget = MomMath.wrapToHalfPi(target);
		let first = -1;
		while (first + 1 < angles.length && angles[first + 1] <= tableTarget) ++first;
		return { angles, tableTarget, first, target: MomMath.remapAngle(target - offset) };
	}

	/** View-relative left and right edges of the chain's zone k, where k may run past either end of the table. */
	primeZoneEdges(chain: PrimeChain, k: number): [number, number] {
		const count = chain.angles.length;
		const edge = (j: number) =>
			chain.angles[((j % count) + count) % count] +
			Math.PI * Math.floor(j / count) -
			chain.tableTarget +
			chain.target;
		return [edge(k), edge(k + 1)];
	}

	/** Draws a zone from unwrapped view-relative angles. Anything outside the FOV is clipped by mapToScreen. */
	drawPrimeZone(zone: ZonePanel, left: number, right: number) {
		// a chain can run past +-pi; shift by whole turns so the zone sits at its real direction
		const turns = 2 * Math.PI * Math.round((left + right) / (4 * Math.PI));
		zone.leftAngle = left - turns;
		zone.rightAngle = right - turns;
		zone.leftPx = this.mapToScreen(zone.leftAngle);
		zone.rightPx = this.mapToScreen(zone.rightAngle);
		this.drawZone(zone);
	}

	/**
	 * Fills a chain's active zones outward from its first zone, up to the first zone past the cgaz boundary.
	 * Returns new gainMax after calculating each zone's gain.
	 */
	fillPrimeZones(
		chain: PrimeChain,
		direction: number,
		boundary: number,
		zones: ZonePanel[],
		gainZonesMap: Map<ZonePanel, number>,
		gainMax: number,
		velocity: vec3,
		wishDir: vec2
	) {
		const count = chain.angles.length;
		for (let step = 1; step < count; ++step) {
			const k = chain.first + direction * step;
			const zone = zones[((k % count) + count) % count];
			const [left, right] = this.primeZoneEdges(chain, k);
			this.drawPrimeZone(zone, left, right);

			const speedGain = this.findPrimeGain(0.5 * (left + right), velocity, wishDir);
			gainZonesMap.set(zone, speedGain);
			if (speedGain < 0) break;
			if (speedGain > gainMax) gainMax = speedGain;

			const innerEdge = direction > 0 ? left : right;
			if (direction * (innerEdge - boundary) >= 0) break;
		}
		return gainMax;
	}

	/** Check whether center screen falls between zone left and right edge (inclusive). */
	shouldHighlight(zone: ZonePanel): boolean {
		const center = (0.5 * this.screenX) / this.scaleX;
		return zone.rightPx - center >= 0 && zone.leftPx - center <= 0;
	}

	/** Speed gain from aiming at a view-relative angle. */
	findPrimeGain(angle: number, velocity: vec2, wishDir: vec2): number {
		const zoneVector = MomMath.rotateVector2D(wishDir, -angle);
		const snapProject = {
			x: Math.round(zoneVector.x * this.primeAccel),
			y: Math.round(zoneVector.y * this.primeAccel)
		};

		const newSpeed = MomMath.magnitude2D({
			x: Number(velocity.x) + Number(snapProject.x),
			y: Number(velocity.y) + Number(snapProject.y)
		});

		return newSpeed - MomMath.magnitude2D(velocity);
	}

	zoneCopy(pasteZone: ZonePanel, copyZone: ZonePanel) {
		pasteZone.leftAngle = copyZone.leftAngle;
		pasteZone.rightAngle = copyZone.rightAngle;
		pasteZone.leftPx = copyZone.leftPx;
		pasteZone.rightPx = copyZone.rightPx;
	}
}
