import {
	CustomizerComponentProperties,
	CustomizerPropertyType,
	CustomizerRenderApi,
	DynamicStyleProperties,
	IHudCustomizerHandler,
	QuerySelector,
	registerHUDCustomizerComponent,
	StyleID
} from 'common/hud-customizer';
import * as LayoutUtil from 'common/layout';
import * as Enum from 'util/enum';
import { traverseChildren } from 'util/functions';
import { GamemodeInfo, GamemodeInfoList, GamemodeInfoProperties } from 'common/gamemode';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import { PanelHandler } from 'util/module-helpers';
import { importLegacySpeedometers } from 'common/speedometer-legacy-import';
import { CopyToOtherPresetsData } from 'modals/popups/hud-customizer-copy-to-other-presets';
import {
	BASE_FILE_PREFIX,
	baseNames,
	baseOrphanedByDelete,
	cloneData,
	DEFAULT_PRESET,
	equalData,
	gamemodeForPreset,
	LayerObject,
	parseBaseFile,
	parseBaseRenames,
	planProfileRename,
	PRESET_NAME_PATTERN,
	PresetFile,
	profileFiles,
	profileNames,
	serializeBaseFile,
	splitPresetFile
} from 'common/hud-layers';
import { componentLayerDelta, resolveLayers } from 'common/hud-keyed-lists';
import {
	applyComponentToBase,
	explicitComponents,
	hasExplicitStyle,
	isKeyedItemExplicit,
	isBaseStyle,
	onlyBaseStyles,
	pruneRenames,
	SPEEDOMETER_PROFILES,
	withBaseStyles,
	withoutBaseStyles,
	LayerParts,
	pickParts,
	resetComponentLayout,
	resolvePreset
} from 'common/hud-presets';
import { addProfilesToBase, mergeColorProfiles } from 'common/speedometer';

/** Structure of layout stored out to JSON */
interface ComponentLayout {
	/** Whether the panel is visible, and its event handler logic runs (TODO: verify this. does HudPRocessInput and stuff fire when this is off?) */
	enabled: boolean;

	/** Offset from left of entire screen TODO: groups? */
	offsetX: number;

	/** Offset from top of entire screen TODO: groups? */
	offsetY: number;

	/** If not provided, gets fit-children */
	width?: number;

	/** If not provided, gets fit-children */
	height?: number;

	/** Stored dynamicStyle values, usually string / number / bool */
	dynamicStyles?: Record<StyleID, any>;
}

/** The parts of a component that Reset resets and Apply to base moves */
export type ResetOptions = LayerParts;

export interface HudLayout extends Record<string, ComponentLayout> {}

enum Axis {
	X = 0,
	Y = 1
}

const Axes = [Axis.X, Axis.Y] as const;

enum DragMode {
	MOVE = 0,
	RESIZE_TOP = 1,
	RESIZE_TOP_RIGHT = 2,
	RESIZE_RIGHT = 3,
	RESIZE_BOTTOM_RIGHT = 4,
	RESIZE_BOTTOM = 5,
	RESIZE_BOTTOM_LEFT = 6,
	RESIZE_LEFT = 7,
	RESIZE_TOP_LEFT = 8
}

type ResizeMode = Exclude<DragMode, DragMode.MOVE>;

interface Gridline {
	panel: Panel;
	offset: number;
}

type GridlineForAxis = [Gridline[], Gridline[]];

/**Returns currently set resolution, not actual window dimensions */
const WINDOW_DIMENSIONS = GameInterfaceAPI.GetWindowDimensions();

/** Panorama assumes 1920x1080 resolution as base */
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

/** Used to scale absolutely positioned panels on different aspect ratios */
const SCALE_FACTOR = WINDOW_DIMENSIONS.height / DEFAULT_HEIGHT;
const VIRTUAL_WIDTH = WINDOW_DIMENSIONS.width / SCALE_FACTOR;
const VIRTUAL_CENTER_X = VIRTUAL_WIDTH / 2;

/** Minimum width/height (px) a panel can be resized to. Overridden per-panel by in-line min-width/min-height. See onEndDrag() comments for more info */
const MINIMUM_PANEL_SIZE = 10;

// Fraction of grid spacing to snap within
const SNAPPING_THRESHOLD = 0.1;

// Fraction of grid spacing to snap within for the center line
const CENTER_SNAPPING_THRESHOLD = 0.15;

/** The dropdown entry that creates a new preset. The name popup only accepts PRESET_NAME_PATTERN, which has no '~' */
const NEW_PRESET_OPTION = 'PresetNew~';

// Margin around the overlay panel. Needed so that resize handles etc. don't get cut off.
const OVERLAY_MARGIN = 32;

interface DynamicStyle {
	properties: Readonly<DynamicStyleProperties>;
	value?: any;
}

type ActiveGamemodeInfo = {
	gamemode: Gamemode;
	id: string;
	name: string; // Localized
};

/**
 * Represents a customizable HUD component, able to be loaded from and serialized to layout files.
 *
 * These classes are responsible for their inner panels's actual layout; updating size, position, enabled etc...
 * update the values saved out to layout, AND update the actual panel's properties.
 *
 * Panorama layouting tends to be very wonky (endless float imprecision, even for nat numbers), so it's easier to store
 * position (offsetX/offsetY) and size (width/height) as JS values, and update the underlying panel's position via
 * setters.
 */
class Component {
	readonly id: string;
	readonly panel: GenericPanel;
	readonly dragPanel?: GenericPanel;
	readonly properties: Readonly<CustomizerComponentProperties>;
	readonly dynamicStyles?: Record<StyleID, DynamicStyle>;

	private _enabled: boolean = undefined!;
	private _offsetX: number = undefined!;
	private _offsetY: number = undefined!;
	private _width: number | undefined = undefined!;
	private _height: number | undefined = undefined!;

	// A record of CustomizerSettings dynamic styles <StyleID, value>
	static referencedValues: Record<string, any> = {};

	// A record of CustomizerSettings dynamic styles <StyleID, Set of StyleID of components that use that style as reference>
	static referencedValueListeners: Record<string, Map<string, Set<string>>> = {};

	/** Called after the customizer changed the component (a style, Reset) */
	private readonly onChanged?: (component: Component) => void;

	/** @see registerHUDCustomizerComponent */
	static register(
		panel: GenericPanel,
		properties: CustomizerComponentProperties,
		onChanged?: (component: Component) => void
	): Component {
		if (!HudCustomizerHandler.defaultLayout[panel.id]) return null;
		return new Component(panel, properties, onChanged);
	}

	private constructor(
		panel: GenericPanel,
		properties: CustomizerComponentProperties,
		onChanged?: (component: Component) => void
	) {
		this.onChanged = onChanged;
		this.panel = panel;
		this.dragPanel = properties.dragPanel;
		this.properties = properties;
		this.id = panel.id;

		const componentLayout = HudCustomizerHandler.presetLayout[this.id];

		if (!componentLayout)
			throw new Error(`HudCustomizer: Could not load layout for HUD customizer component ${this.id}`);

		this.enabled = this.properties.canDisable === false ? true : (componentLayout.enabled ?? true);
		this.width = componentLayout.width ?? undefined;
		this.height = componentLayout.height ?? undefined;
		this._offsetY = componentLayout.offsetY; // Stupid, but needed with current setPosition stuff. Move to C++!
		this.offsetX = this.getScaledOffsetX(componentLayout.offsetX);
		this.offsetY = componentLayout.offsetY;

		if (properties.dynamicStyles) {
			this.dynamicStyles = {};

			for (const [styleID, styleProps] of Object.entries(properties.dynamicStyles)) {
				const value = componentLayout.dynamicStyles?.[styleID as StyleID];

				if (value === undefined) {
					if (styleProps.type === CustomizerPropertyType.NONE) {
						// NONE types have no value
						this.dynamicStyles[styleID] = { properties: styleProps as DynamicStyleProperties };
						continue;
					}
					throw new Error(
						`HudCustomizer: Could not load dynamic style value for ${styleID} in component ${this.id}`
					);
				}

				const dynamicStyle = {
					properties: styleProps as DynamicStyleProperties,
					value
				};

				if (String(value).startsWith('$')) {
					const refKey = value.slice(1);
					if (!Component.referencedValueListeners[refKey]) {
						Component.referencedValueListeners[refKey] = new Map();
					}

					const styleSet = Component.referencedValueListeners[refKey].get(this.id) ?? new Set<StyleID>();
					styleSet.add(styleID as StyleID);
					Component.referencedValueListeners[refKey].set(this.id, styleSet);
				}

				for (const { event, panel, callback } of styleProps.events ?? []) {
					// Register provided callbacks events requested on the given panel. When that event fires, we
					// call the callback with the current DynamicStyle's value, allowing components to style panels
					// they generate.
					// Not cleaning these handlers up since customizer is reloaded at same time as everything else,
					// Panorama cleans them up.
					$.RegisterEventHandler(event, panel, (...args: any[]) => {
						const styleValue =
							dynamicStyle.properties.valueFn?.(dynamicStyle.value as any) ?? dynamicStyle.value;
						(callback as any)(styleValue, ...args);
					});
				}

				for (const { event, callback } of styleProps.unhandledEvents ?? []) {
					$.RegisterForUnhandledEvent(event, (...args: any[]) => {
						const styleValue =
							dynamicStyle.properties.valueFn?.(dynamicStyle.value as any) ?? dynamicStyle.value;
						(callback as any)(styleValue, ...args);
					});
				}

				this.dynamicStyles[styleID] = dynamicStyle;
				this.applyDynamicStyle(dynamicStyle, true);
			}
		}

		properties.postInit?.();
	}

	get enabled(): boolean {
		return this._enabled;
	}

	set enabled(enabled: boolean) {
		this._enabled = enabled;
		this.panel.enabled = enabled;
	}

	get offsetX(): number {
		return this._offsetX;
	}

	set offsetX(x: number) {
		this._offsetX = x;
		LayoutUtil.setPosition(this.panel, this._offsetX, this._offsetY);
	}

	get offsetY(): number {
		return this._offsetY;
	}

	set offsetY(y: number) {
		this._offsetY = y;
		LayoutUtil.setPosition(this.panel, this._offsetX, this._offsetY);
	}

	get width(): number | undefined {
		return this._width;
	}

	set width(width: number | undefined) {
		this._width = width;

		// If we're passed an undefined width, do nothing so that the panel can use fit-children
		if (width !== undefined) {
			LayoutUtil.setWidth(this.panel, width);
		}
	}

	get height(): number | undefined {
		return this._height;
	}

	set height(height: number | undefined) {
		this._height = height;

		if (height !== undefined) {
			LayoutUtil.setHeight(this.panel, height);
		}
	}

	/**
	 * Scales the offset to current aspect ratio. If the component has static width, it uses the center as anchor point
	 * @param offset: An offset in 1920x1080 resolution
	 * @returns An offset scaled to current aspect ratio
	 */
	getScaledOffsetX(offset: number): number {
		const anchor = this.width ? offset + this.width / 2 : offset;

		if (anchor < DEFAULT_WIDTH / 3) {
			// 1. Left Anchored: Distance from left edge remains constant
			return offset;
		} else if (anchor > (DEFAULT_WIDTH / 3) * 2) {
			// 2. Right Anchored: Distance from right edge remains constant
			const distanceToRight = DEFAULT_WIDTH - offset;
			return VIRTUAL_WIDTH - distanceToRight;
		} else {
			// 3. Center Anchored: Distance from center remains constant
			const distanceToCenter = offset - DEFAULT_WIDTH / 2;
			return VIRTUAL_CENTER_X + distanceToCenter;
		}
	}

	/**
	 * Rescales current offsetX to 1920x1080 for saving
	 */
	getDefaultOffsetX() {
		const anchor = this.width ? this.offsetX + this.width / 2 : this.offsetX;

		if (anchor < DEFAULT_WIDTH / 3) {
			// Left Anchored: Distance from left edge is 1:1
			return this.offsetX;
		} else if (anchor > VIRTUAL_WIDTH - DEFAULT_WIDTH / 3) {
			// Right Anchored: Re-apply distance from the virtual right edge to 1920
			return this.offsetX - VIRTUAL_WIDTH + DEFAULT_WIDTH;
		} else {
			// Center Anchored: Re-apply distance from the virtual center to 960
			return this.offsetX - VIRTUAL_CENTER_X + DEFAULT_WIDTH / 2;
		}
	}

	/** Gets serializable parts of the components for saving */
	getLayout(): ComponentLayout {
		return {
			enabled: this.enabled,
			offsetX: this.getDefaultOffsetX(),
			offsetY: this.offsetY,
			...(this.width !== null && { width: this.width }),
			...(this.height !== null && { height: this.height }),
			...(this.dynamicStyles && {
				dynamicStyles: Object.fromEntries(
					Object.entries(this.dynamicStyles)
						.filter(([_, dynamicStyle]) => dynamicStyle.value !== null)
						.map(([styleID, dynamicStyle]) => [styleID, dynamicStyle.value])
				)
			})
		};
	}

	/**
	 * Reset a component to the preset's parent: its base, or the shipped default without one. See resetComponentLayout
	 * for what is reset.
	 */
	reset(options: ResetOptions): void {
		const parent = HudCustomizerHandler.parentLayout[this.id];
		if (!parent)
			throw new Error(`HudCustomizer: Could not load default layout for HUD customizer component ${this.id}`);

		const target = resetComponentLayout(this.id, this.getLayout(), parent, options) as unknown as ComponentLayout;

		if (options.styles) {
			this.width = target.width ?? undefined;
			this.height = target.height ?? undefined;

			for (const [styleID, dynamicStyle] of Object.entries(this.dynamicStyles ?? {})) {
				const value = target.dynamicStyles?.[styleID];
				if (value !== undefined && value !== dynamicStyle.value) {
					dynamicStyle.value = value;
					this.applyDynamicStyle(dynamicStyle);
				}
			}
		}

		if (options.position) {
			this.offsetX = this.getScaledOffsetX(target.offsetX);
			this.offsetY = target.offsetY;
		}

		this.properties.postInit?.();
		this.onChanged?.(this);
	}

	/** Reset a single dynamic style to it's original state */
	resetSingle(styleID: StyleID): void {
		const defaultValue = HudCustomizerHandler.parentLayout[this.id].dynamicStyles?.[styleID];
		this.setDynamicStyle(styleID, defaultValue);
	}

	/** Applies the value (usually from stored layout/live settings) to a component */
	setDynamicStyle(styleID: StyleID, value: any): void {
		if (!this.dynamicStyles || !this.dynamicStyles[styleID])
			throw new Error(`Component ${this.id} does not have dynamic style ${styleID}`);

		const dynamicStyle = this.dynamicStyles[styleID];
		dynamicStyle.value = value;
		this.applyDynamicStyle(dynamicStyle);
		this.onChanged?.(this);
	}

	applyDynamicStyle(style: DynamicStyle, isInit: boolean = false): void {
		const targetPanels: GenericPanel[] = [];
		if (style.properties.targetPanel) {
			const selectors = Array.isArray(style.properties.targetPanel)
				? style.properties.targetPanel
				: [style.properties.targetPanel];
			for (const selector of selectors) {
				const targets = cssPanelLookup(this.panel, selector);
				if (targets) {
					targetPanels.push(...(Array.isArray(targets) ? targets : [targets]));
				}
			}
		} else {
			targetPanels.push(this.panel);
		}

		let styleValue = style.value;
		if (String(styleValue).startsWith('$')) {
			const refKey = styleValue.slice(1);
			styleValue = Component.referencedValues?.[refKey] ?? undefined;
		}

		if (style.properties.styleProperty && styleValue !== undefined) {
			const modifiedValue = style.properties.valueFn?.(styleValue) ?? styleValue;

			if (modifiedValue !== undefined) {
				for (const panel of targetPanels) {
					(panel as any).style[style.properties.styleProperty] = modifiedValue;
					// @ts-expect-error wadsasdasd
					panel.MarkStylesDirty(true);
				}
			}
		}

		if (styleValue !== undefined && style.properties.callbackFunc) {
			for (const panel of targetPanels) {
				style.properties.callbackFunc(panel, styleValue);
			}
		}

		if (!isInit && style.properties.onChanged) {
			style.properties.onChanged(styleValue);
		}
	}

	reloadDynamicStyles(): void {
		if (!this.dynamicStyles) return;
		for (const style of Object.values(this.dynamicStyles)) {
			this.applyDynamicStyle(style);
		}
	}
}

@PanelHandler()
class HudCustomizerHandler implements IHudCustomizerHandler {
	readonly panels = {
		customizer: $.GetContextPanel<HudCustomizer>()!,
		dragPanel: $<Panel>('#DragPanel')!,
		dragResizeKnob: $<Panel>('#DragKnob')!,
		overlay: $<Panel>('#Overlay')!,
		overlayInner: $<Panel>('#OverlayInner')!,
		settings: $<Panel>('#CustomizerSettings')!,
		presetSettings: $<Panel>('#PresetSettings')!,
		presetSettingList: $<Panel>('#PresetSettingsList')!,
		generalComponentContainer: $<Panel>('#GeneralComponentsContainer')!,
		generalComponentList: $<Panel>('#GeneralComponentList')!,
		gamemodeComponentContainer: $<Panel>('#GamemodeComponentsContainer')!,
		gamemodeComponentList: $<Panel>('#GamemodeComponentList')!,
		activeComponentSettings: $<Panel>('#ActiveComponentSettings')!,
		activeComponentSettingsList: $<Panel>('#ActiveComponentSettingsList')!,
		resizeKnobs: $<Panel>('#ResizeKnobs')!,
		grid: $.GetContextPanel().GetParent()!.FindChildTraverse('HudCustomizerGrid')!
	};

	// Makes sure layout isn't saved before hud is initialized
	customizerReady: boolean;

	components: Record<string, Component> = {};
	gridlines: GridlineForAxis = [[], []];
	activeComponent?: Component | undefined;
	activeGridlines: [Gridline | undefined, Gridline | undefined] = [undefined, undefined];
	fonts: string[] = [];

	resizeKnobs: Record<ResizeMode, Button> = undefined!;

	dragStartHandle?: number;
	dragEndHandle?: number;
	onThinkHandle?: number;

	dragMode?: DragMode;

	gridSize: number = undefined!;
	enableSnapping: boolean = undefined!;

	/** Every cfg/hud layout file name: presets, bases and exports */
	presetList: Set<string>;

	/** What the components show: the resolved layout of the current preset */
	static presetLayout: HudLayout;
	/** Shipped layout of the current gamemode, base_default + <mode>_default (L0 + L1) */
	static defaultLayout: HudLayout;
	/** What the current preset is saved relative to, and what Reset goes back to: L0 + L1 + its base (L2) */
	static parentLayout: HudLayout;

	/** The shipped base, cfg/hud/base_default.kv3 (L0) */
	shippedBaseLayout: HudLayout;
	/**
	 * Fields of base_<current preset> (L2), null when that file doesn't exist. The preset follows the base whenever
	 * it exists. Always null for the default preset, which follows the shipped base_default.
	 */
	baseLayout: LayerObject | null = null;
	/** Color profile renames recorded in the base, see hud-layers' parseBaseRenames */
	baseRenames: Record<string, string> = {};
	/** Color profiles renamed in the editor since the last save, written into the base on save */
	pendingRenames: Record<string, string> = {};
	/** The current preset file as stored (L3). Null for the default preset */
	presetFile: PresetFile | null = null;

	/** Each component's own settings in the current preset, as they are now; see getExplicitEntry */
	explicitEntries = new Map<string, LayerObject | undefined>();
	/** Components changed since their Apply to base button and divergence dots were last updated */
	changedComponents = new Set<Component>();
	/** Set while reloadLayout registers the components, so the component list is built once at the end */
	reloading = false;
	/** Divergence dots of the active component's settings, by style */
	divergenceDots = new Map<StyleID, Panel>();
	/** Apply to base buttons of the component list, by component */
	applyButtons = new Map<string, GenericPanel>();

	gamemodeInfo: ActiveGamemodeInfo;

	currentPreset: string;

	//Used because of a font bug
	private os: string;

	constructor() {
		registerHUDCustomizerComponent(this.panels.settings, {
			name: $.Localize('#Customizer_Customizer_Name'),
			dragPanel: $('#CustomizerSettingsHeader')!,
			resizeY: false,
			resizeX: false,
			canDisable: false,
			dynamicStyles: {
				// DISABLED UNTIL INPUT ISSUES ARE SOLVED, REFER TO CONVERSATION HERE:
				// https://discord.com/channels/235111289435717633/1337923493177589790/1540681350309224488
				// selectOnRightClick: {
				// 	name: $.Localize('#Customizer_Customizer_SelectOnRightClick'),
				// 	type: CustomizerPropertyType.CHECKBOX,
				// 	callbackFunc: (_, value) => this.toggleSelectOnRightClick(value)
				// },
				selectedBorder: {
					name: $.Localize('#Customizer_Customizer_SelectedBorder'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) =>
						this.panels.dragPanel.SetHasClass('hud-customizer-dragpanel__selected-border', value)
				},
				enableGrid: {
					name: $.Localize('#Customizer_Customizer_EnableGrid'),
					type: CustomizerPropertyType.CHECKBOX,
					children: [{ styleID: 'gridSize', showWhen: true }],
					callbackFunc: (_, value) => this.panels.grid.SetHasClass('hud-customizer-grid--enabled', value),
					onChanged: () => this.createGridLines(this.gridSize)
				},
				gridSize: {
					name: $.Localize('#Customizer_Customizer_GridSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (this.gridSize = value),
					onChanged: () => this.createGridLines(this.gridSize),
					settingProps: { min: 4, max: 12 }
				},
				enableSnapping: {
					name: $.Localize('#Customizer_Customizer_EnableSnapping'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (this.enableSnapping = value)
				},
				defaultStyles: {
					name: $.Localize('#Customizer_Customizer_DefaultStyles'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'fontStyles' }, { styleID: 'colors' }]
				},
				fontStyles: {
					name: $.Localize('#Customizer_Customizer_FontStyles'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'fontPrimary' }, { styleID: 'fontSecondary' }]
				},
				fontPrimary: {
					name: $.Localize('#Customizer_Customizer_FontPrimary'),
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => (Component.referencedValues['fontPrimary'] = value),
					onChanged: (value) => this.updateReferencedValue('fontPrimary', value)
				},
				fontSecondary: {
					name: $.Localize('#Customizer_Customizer_FontSecondary'),
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => (Component.referencedValues['fontSecondary'] = value),
					onChanged: (value) => this.updateReferencedValue('fontSecondary', value)
				},
				colors: {
					name: $.Localize('#Customizer_Colors'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'fontColor' },
						{ styleID: 'gainColor' },
						{ styleID: 'lossColor' },
						{ styleID: 'progressBarBackgroundGradient' },
						{ styleID: 'progressBarFillGradient' },
						{ styleID: 'progressBarBlockedGradient' }
					]
				},
				fontColor: {
					name: $.Localize('#Customizer_Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Component.referencedValues['fontColor'] = value),
					onChanged: (value) => this.updateReferencedValue('fontColor', value)
				},
				gainColor: {
					name: $.Localize('#Customizer_Gain'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Component.referencedValues['gainColor'] = value),
					onChanged: (value) => this.updateReferencedValue('gainColor', value)
				},
				lossColor: {
					name: $.Localize('#Customizer_Loss'),
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (Component.referencedValues['lossColor'] = value),
					onChanged: (value) => this.updateReferencedValue('lossColor', value)
				},
				progressBarBackgroundGradient: {
					name: $.Localize('#Customizer_Customizer_ProgressBarBackgroundGradient'),
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => (Component.referencedValues['progressBarBackgroundGradient'] = value),
					onChanged: (value) => this.updateReferencedValue('progressBarBackgroundGradient', value)
				},
				progressBarFillGradient: {
					name: $.Localize('#Customizer_Customizer_ProgressBarFillGradient'),
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => (Component.referencedValues['progressBarFillGradient'] = value),
					onChanged: (value) => this.updateReferencedValue('progressBarFillGradient', value)
				},
				progressBarBlockedGradient: {
					name: $.Localize('#Customizer_Customizer_ProgressBarBlockedGradient'),
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => (Component.referencedValues['progressBarBlockedGradient'] = value),
					onChanged: (value) => this.updateReferencedValue('progressBarBlockedGradient', value)
				}
			},
			postInit: () => {
				for (const refKey of Object.keys(Component.referencedValues)) {
					this.updateReferencedValue(refKey, Component.referencedValues[refKey], true);
				}

				this.createGridLines(this.gridSize);
			}
		});

		// Registers the *internal* variant of this event -- HudCustomizer_OpenedInternal is dispatched first and lets
		// components with special handling know to prepare for editing mode.
		$.RegisterForUnhandledEvent('HudCustomizer_OpenedInternal', () => this.enableEditing());
		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => {
			this.disableEditing();
			if (this.customizerReady) this.save();
		});

		$.RegisterForUnhandledEvent('MapCache_MapLoad' as any, () => {
			this.panels.customizer.toggleUI(false);

			const gamemode = GameModeAPI.GetCurrentGameMode();
			const info = GamemodeInfo.get(gamemode);
			this.gamemodeInfo = {
				gamemode,
				id: info.id,
				name: $.Localize(info.i18n)
			};

			this.shippedBaseLayout =
				this.panels.customizer.loadLayout(BASE_FILE_PREFIX + DEFAULT_PRESET) ?? ({} as HudLayout);

			// One-time import of the legacy speedometer files, may create presets and select them
			if (importLegacySpeedometers(this.panels.customizer, this.shippedBaseLayout)) {
				this.presetList = new Set(this.panels.customizer.listLayouts());
			}

			this.initializeLayouts();
			this.updatePresetSettings();

			if (this.currentPreset === DEFAULT_PRESET) {
				this.defaultPresetStateOn();
			} else {
				this.defaultPresetStateOff();
			}

			// Once HUD is fully initialized, let components awaiting registration know to load component
			$.DispatchEvent('HudCustomizer_Ready');
			this.customizerReady = true;
		});

		// TODO: This was just for case of someone changin layout via file and wanting to update ingame.
		// Not  sure if we should even support, and dont wanna think about rn.
		// $.RegisterEventHandler('HudCustomizer_LayoutReloaded', this.panels.customizer, () => {
		// 	this.load();
		// });

		this.os = GameInterfaceAPI.GetOperatingSystem();

		this.customizerReady = false;
		this.gridlines = [[], []];
		this.activeGridlines = [undefined, undefined];
		this.activeComponent = undefined;

		this.panels.activeComponentSettings.visible = false;

		this.fonts = UiToolkitAPI.GetSortedValidFontNames().toSorted((a, b) => a.localeCompare(b));

		UiToolkitAPI.GetGlobalObject()['HudCustomizerHandler'] = this;
	}

	// CustomizerSettings dynamic styles are used as default global styles
	// They can be referenced in base_default.kv3 by using a string formatted like this: "$someStyleID"
	// When a dynamic style is modified/loaded it calls this function with the it's styleID and a new value
	// This functions then re-applies ALL styles on a component that uses that referenced value.
	// Hud Customizer Panel in hud.xml MUST be placed after all other panels registered with hud customizer for this to initialize hud properly
	updateReferencedValue(refKey: string, newValue: any, isInit: boolean = false): void {
		Component.referencedValues[refKey] = newValue;

		const listeners = Component.referencedValueListeners[refKey];
		if (!listeners) return;

		listeners.forEach((styleIDs, componentID) => {
			const component = this.components[componentID];
			if (component) {
				for (const styleID of styleIDs) {
					const style = component.dynamicStyles?.[styleID];
					if (style) component.applyDynamicStyle(style, isInit);
				}
			}
		});
	}

	/**
	 * Recreates the preset setting list
	 */
	updatePresetSettings() {
		const panel = this.panels.presetSettingList;
		panel.RemoveAndDeleteChildren();

		const gamemodeID = this.gamemodeInfo.id;

		if (!this.presetList) {
			this.presetList = new Set(this.panels.customizer.listLayouts());
		}

		const settingsHeader = $.Localize('#Customizer_PresetSettings_Header').replace(
			'{gamemodeName}',
			this.gamemodeInfo.name
		);

		this.panels.settings.SetDialogVariable('preset_name', settingsHeader);

		const createDropdown = (parent: GenericPanel) => {
			const panel = $.CreatePanel('Panel', parent, '');
			panel.LoadLayoutSnippet('dynamic-dropdown');
			panel.SetDialogVariable('name', $.Localize('#Customizer_PresetSettings_Label'));
			const dropdown = panel.FindChildTraverse<DropDown>('DropDown')!;

			// This gamemode's presets, plus every profile name another gamemode or a base uses. Picking one of those
			// creates the preset here, following base_<name> when it exists. Default is always at the top
			const ownPresets = this.getPresetNames(gamemodeID);
			const names = [...new Set([...ownPresets, ...profileNames(this.getLayoutNames(), this.getGamemodeIDs())])];
			names.sort((a, b) => {
				if (a === DEFAULT_PRESET) return -1;
				if (b === DEFAULT_PRESET) return 1;
				return a.localeCompare(b);
			});

			for (const preset of names) {
				const optionPanel = $.CreatePanel('Label', dropdown, preset);
				optionPanel.text = preset;
				dropdown.AddOption(optionPanel);
			}

			const newOption = $.CreatePanel('Label', dropdown, NEW_PRESET_OPTION);
			newOption.text = $.Localize('#Customizer_Preset_NewEntry');
			dropdown.AddOption(newOption);

			dropdown.SetSelected(this.currentPreset ?? DEFAULT_PRESET);

			dropdown.SetPanelEvent('oninputsubmit', () => {
				const value = dropdown.GetSelected()?.id;
				if (!value || value === this.currentPreset) return;

				if (value === NEW_PRESET_OPTION) {
					// Fires this event again, with the current preset
					dropdown.SetSelected(this.currentPreset);
					this.showNewPresetPopup();
					return;
				}

				// Next frame: creating a preset rebuilds this list, which must not delete the dropdown while its own
				// event runs
				$.Schedule(0, () => {
					//Attempt to save when changing presets
					if (this.customizerReady) this.save();

					if (ownPresets.includes(value)) {
						this.changePreset(value);
						this.updatePresetSettings();
					} else {
						this.createPreset(value);
					}
				});
			});
		};

		const createButtons = (parent: GenericPanel) => {
			const panel = $.CreatePanel('Panel', parent, '');
			panel.LoadLayoutSnippet('preset-buttons');

			const isDefaultPreset = this.currentPreset === DEFAULT_PRESET;

			const saveAsNew = panel.FindChild('PresetCreateNew');
			(saveAsNew.GetFirstChild() as Label).text = $.Localize('#Customizer_Preset_SaveAsNew');
			saveAsNew.SetPanelEvent('onactivate', () =>
				this.showNamePopup(
					$.Localize('#Customizer_Preset_SaveAsNew_Header'),
					$.Localize('#Customizer_Preset_CreateNew_InputLabel'),
					$.Localize('#Customizer_Preset_SaveAsNew'),
					this.getJoinBaseNote(),
					(name) => this.saveAsNewPreset(name)
				)
			);
			setTooltip(saveAsNew, $.Localize('#Customizer_Preset_SaveAsNew_Tooltip'));

			const renamePreset = panel.FindChild('PresetRename');
			const renamePresetLabel = renamePreset.GetFirstChild() as Label;
			renamePresetLabel.text = $.Localize('#Customizer_Preset_Rename');

			renamePreset.enabled = !isDefaultPreset;

			renamePreset.SetPanelEvent('onactivate', () => {
				const files = profileFiles(this.getLayoutNames(), this.currentPreset, this.getGamemodeIDs());
				const renamed = [...(files.base ? [files.base] : []), ...files.presets];
				if (!renamed.includes(this.getFullPresetName())) renamed.push(this.getFullPresetName());
				this.showNamePopup(
					$.Localize('#Customizer_Preset_Rename_Header'),
					$.Localize('#Customizer_Preset_Rename_InputLabel').replace('{currentPreset}', this.currentPreset),
					$.Localize('#Customizer_Preset_Rename'),
					$.Localize('#Customizer_Base_RenameNote').replace('{files}', renamed.join(', ')),
					(name) => this.renameProfile(name)
				);
			});

			const deletePreset = panel.FindChild('PresetDelete');
			const deletePresetLabel = deletePreset.GetFirstChild() as Label;
			deletePresetLabel.text = $.Localize('#Common_Delete');

			deletePreset.enabled = !isDefaultPreset;

			deletePreset.SetPanelEvent('onactivate', () => {
				const preset = this.currentPreset;
				const orphanedBase = baseOrphanedByDelete(
					this.getLayoutNames(),
					this.getFullPresetName(preset),
					this.getGamemodeIDs()
				);

				if (orphanedBase) {
					UiToolkitAPI.ShowGenericPopupThreeOptions(
						$.Localize('#Customizer_Preset_Delete_Header'),
						$.Localize('#Customizer_Base_DeleteWithPreset')
							.replace('{currentPreset}', preset)
							.replace('{base}', orphanedBase),
						'',
						$.Localize('#Customizer_Base_DeleteWithPreset_Keep'),
						() => this.deletePreset(preset, false),
						$.Localize('#Customizer_Base_DeleteWithPreset_Both'),
						() => this.deletePreset(preset, true),
						$.Localize('#Common_Cancel'),
						() => UiToolkitAPI.CloseAllVisiblePopups()
					);
					return;
				}

				UiToolkitAPI.ShowGenericPopupYesNo(
					$.Localize('#Customizer_Preset_Delete_Header'),
					$.Localize('#Customizer_Preset_Delete_PopupLabel').replace('{currentPreset}', preset),
					'',
					() => this.deletePreset(preset, false),
					() => UiToolkitAPI.CloseAllVisiblePopups()
				);
			});

			const copyPresetData = () => {
				return {
					title: $.Localize('#Customizer_Preset_Copy_Header'),
					gamemodes: GamemodeInfoList,
					presetList: this.getLayoutNames(),
					onConfirm: (_, presetList: { gamemodeID: string; presetName: string }[]) =>
						this.copyPreset(presetList)
				} as CopyToOtherPresetsData;
			};

			const copyPreset = panel.FindChild('PresetCopy');
			const copyPresetLabel = copyPreset.GetFirstChild() as Label;
			copyPresetLabel.text = $.Localize('#Customizer_Preset_Copy');

			copyPreset.enabled = !isDefaultPreset;
			copyPreset.SetPanelEvent('onactivate', () =>
				UiToolkitAPI.ShowCustomLayoutPopupParameters(
					'CopyToOtherPresets',
					'file://{resources}/layout/modals/popups/hud-customizer-copy-to-other-presets.xml',
					`data=${UiToolkitAPI.RegisterJSCallback(() => copyPresetData())}`
				)
			);
			copyPreset.SetPanelEvent('onmouseover', () =>
				UiToolkitAPI.ShowTextTooltip(copyPreset.id, $.Localize('#Customizer_Preset_Copy_Tooltip'))
			);
			copyPreset.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
		};

		const wrapper = $.CreatePanel('Panel', panel, 'ParentWrapper', {
			class: 'hud-customizer-settings__row-wrapper'
		});

		createDropdown(wrapper);
		createButtons(wrapper);
		this.createBaseControls(wrapper);
	}

	/**
	 * Under the preset buttons: which base the profile has and how many gamemodes use it, then Use preset as base
	 */
	createBaseControls(parent: GenericPanel): void {
		const isDefaultPreset = this.currentPreset === DEFAULT_PRESET;
		const container = $.CreatePanel('Panel', parent, '');
		container.LoadLayoutSnippet('preset-base-buttons');

		const info = container.FindChildTraverse<Label>('PresetProfileInfo')!;
		info.visible = !isDefaultPreset;
		if (!isDefaultPreset) {
			info.text = $.Localize(this.baseLayout ? '#Customizer_Base_Follows' : '#Customizer_Base_None')
				.replaceAll('{profile}', this.currentPreset)
				.replace('{count}', String(this.getFollowerCount()));
		}

		const setupButton = (id: string, tooltipToken: string, onActivate: () => void) => {
			const button = container.FindChildTraverse(id)!;
			button.SetPanelEvent('onactivate', onActivate);
			setTooltip(button, $.Localize(tooltipToken));
			return button;
		};

		const usePreset = setupButton('PresetUseAsBase', '#Customizer_Base_UsePreset_Tooltip', () =>
			this.confirmUsePresetAsBase()
		);
		usePreset.enabled = !isDefaultPreset;
	}

	/** Every cfg/hud layout file name: presets, bases and exports. */
	getLayoutNames(): string[] {
		return [...this.presetList];
	}

	getGamemodeIDs(): string[] {
		return GamemodeInfoList.map((info) => info.id);
	}

	/** Names of a gamemode's presets, without the gamemode prefix. Includes default. */
	getPresetNames(gamemodeID: string = this.gamemodeInfo.id): string[] {
		const ids = this.getGamemodeIDs();
		const names = this.getLayoutNames()
			.filter((name) => gamemodeForPreset(name, ids) === gamemodeID)
			.map((name) => name.slice(gamemodeID.length + 1));
		return [...new Set([DEFAULT_PRESET, ...names])];
	}

	/** The name popup's note about names that already have a base, which a new preset of that name follows */
	getJoinBaseNote(): string {
		const bases = baseNames(this.getLayoutNames());
		return bases.length > 0
			? $.Localize('#Customizer_Preset_JoinBaseNote').replace('{bases}', bases.join(', '))
			: '';
	}

	showNamePopup(
		title: string,
		inputLabel: string,
		okLabel: string,
		note: string,
		callback: (name: string) => void,
		prefilledText = ''
	) {
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'PresetName',
			'file://{resources}/layout/modals/popups/hud-customizer-layout-name.xml',
			`title=${title}&input_label=${inputLabel}&ok_btn_label=${okLabel}&note=${note}&prefilled_text=${prefilledText}&callback=${UiToolkitAPI.RegisterJSCallback(
				callback
			)}`
		);
	}

	showNewPresetPopup() {
		this.showNamePopup(
			$.Localize('#Customizer_Preset_CreateNew_Header'),
			$.Localize('#Customizer_Preset_CreateNew_InputLabel'),
			$.Localize('#Customizer_Preset_CreateNew'),
			this.getJoinBaseNote(),
			(name: string) => {
				this.save();
				this.createNewPreset(name);
			}
		);
	}

	/** Whether `name` can be a new preset of this gamemode. Shows a toast when it can't. */
	checkNewPresetName(name: string): boolean {
		if (name === DEFAULT_PRESET) {
			displayToast(
				'Reserved name!',
				'Default preset is reserved.\nyou cannot rename it or rename other presets to it!'
			);
			return false;
		}
		// The name popup only accepts valid names
		if (!PRESET_NAME_PATTERN.test(name)) return false;

		const exists = this.getPresetNames().includes(name);
		// A bhop preset "hl_x" would be stored as bhop_hl_x, which is bhop_hl's preset "x"
		const otherGamemode =
			gamemodeForPreset(this.getFullPresetName(name), this.getGamemodeIDs()) !== this.gamemodeInfo.id;
		if (exists || otherGamemode) {
			displayToast(
				$.Localize('#Customizer_Preset_CreateNew_Header'),
				$.Localize(exists ? '#Customizer_Preset_Exists' : '#Customizer_Preset_NameClash').replace(
					'{preset}',
					name
				)
			);
			return false;
		}
		return true;
	}

	/**
	 * New (the last dropdown entry): a clean preset of this gamemode, with nothing of its own, so it shows the shipped
	 * default, or base_<name> when that exists.
	 */
	createNewPreset(newPreset: string): boolean {
		if (!this.checkNewPresetName(newPreset)) return false;
		return this.createPreset(newPreset);
	}

	/** Creates and selects an empty preset of this gamemode. It follows base_<name> if that exists. */
	createPreset(name: string): boolean {
		if (!this.writePresetFile(name, { components: {} })) return false;
		this.changePreset(name);
		this.updatePresetSettings();
		if (this.baseLayout) {
			displayInfoToast(
				$.Localize('#Customizer_Preset_CreateNew_Header'),
				$.Localize('#Customizer_Base_Joined')
					.replace('{preset}', name)
					.replace('{base}', this.getBaseFileName())
			);
		}
		return true;
	}

	/**
	 * Save as new: a new preset of this gamemode that looks like the current one. Without base_<new>, the current base
	 * (if any) is copied to it and the new preset gets the current one's own settings. With base_<new>, the new preset
	 * follows it and stores whatever differs from it.
	 * The color profiles it uses are added to that base.
	 */
	saveAsNewPreset(name: string): void {
		if (!this.checkNewPresetName(name)) return;

		this.save(false);
		const current = this.getCurrentLayoutForDelta();
		const targetBase = BASE_FILE_PREFIX + name;

		const loaded = this.loadBase(name);
		let base: LayerObject | null = loaded?.layout ?? null;
		let renames: Record<string, string> = loaded?.renames ?? {};
		if (!base && this.baseLayout) {
			base = cloneData(this.baseLayout);
			renames = { ...this.baseRenames };
			const data = serializeBaseFile(base, renames);
			if (!this.panels.customizer.saveLayout(targetBase, data as unknown as HudLayout)) return;
			this.presetList.add(targetBase);
		} else if (base) {
			base = this.addProfilesToNamedBase(name, base, renames, current);
		}

		const defaults = HudCustomizerHandler.defaultLayout as unknown as LayerObject;
		const parent = resolvePreset(defaults, base, {}, renames).parent;
		const components = explicitComponents(parent, current as unknown as LayerObject, base !== null);
		if (!this.writePresetFile(name, { components })) return;

		this.changePreset(name);
		this.updatePresetSettings();
		this.showSavedToast();
	}

	showSavedToast(): void {
		displayInfoToast(
			$.Localize('#Customizer_Preset_Saved_Header'),
			$.Localize('#Customizer_Preset_Saved').replace('{preset}', this.currentPreset)
		);
	}

	/**
	 * Adds the color profiles `layout` uses to the profiles of base_<name> (see addProfilesToBase), writes the base
	 * when that changed it, and points `layout`'s speedometers at renamed clashes. Returns the base.
	 */
	addProfilesToNamedBase(
		name: string,
		base: LayerObject,
		renames: Record<string, string>,
		layout: HudLayout
	): LayerObject {
		const styles = layout.Speedometer?.dynamicStyles;
		if (!styles?.rangeColorProfiles) return base;

		const result = addProfilesToBase(
			base,
			this.shippedBaseLayout.Speedometer?.dynamicStyles?.rangeColorProfiles,
			styles.rangeColorProfiles,
			styles.speedometers
		);
		if (styles.speedometers !== undefined) styles.speedometers = result.speedometers;
		styles.rangeColorProfiles = result.profiles;
		if (result.changed) {
			const data = serializeBaseFile(result.base, renames) as unknown as HudLayout;
			if (!this.panels.customizer.saveLayout(BASE_FILE_PREFIX + name, data)) {
				$.Warning(`Failed to save /cfg/hud/${BASE_FILE_PREFIX + name}.kv3`);
			}
		}
		return result.base;
	}

	/**
	 * Changes the preset based on it's name. Loads the preset and its base, updates the layers, currentPreset and
	 * persistentStorage
	 * @param name Name of the preset
	 */
	changePreset(name: string) {
		const gamemodeID = this.gamemodeInfo.id;

		this.currentPreset = name;
		this.presetFile = name === DEFAULT_PRESET ? null : (this.loadPresetFile(name) ?? { components: {} });
		this.setBase(name === DEFAULT_PRESET ? null : this.loadBase(name));
		this.updateLayers();

		$.persistentStorage.setItem(`hud-customizer.preset.${gamemodeID}`, name);
		this.reloadLayout();

		if (name === DEFAULT_PRESET) {
			this.defaultPresetStateOn();
		} else {
			this.defaultPresetStateOff();
		}
	}

	/**
	 * Reloads the layout from preset layout.
	 * Assumes the exact same list of components exists
	 */
	reloadLayout() {
		const previous = this.components;
		this.components = {};
		this.explicitEntries.clear();
		// Every loadComponent would rebuild the component list, build it once at the end instead
		this.reloading = true;
		for (const component of Object.values(previous)) {
			this.components[component.id] = component;
			this.loadComponent(component.panel, component.properties);
		}
		this.reloading = false;
		this.generateComponentList();

		//Panorama needs time to layout panels
		this.setActiveComponent(this.activeComponent);
	}

	/**
	 * Renames the whole profile: base_<old> and the <old> preset of every gamemode become <new>. Nothing is copied and
	 * nothing looks different. Refused when <new> is used by any preset or base. When a file can't be renamed, the ones
	 * renamed before it are renamed back.
	 */
	renameProfile(newName: string) {
		const oldName = this.currentPreset;
		this.save(false);

		const ids = this.getGamemodeIDs();
		const plan = planProfileRename(this.getLayoutNames(), oldName, newName, ids);
		if (plan.ok === false) {
			const [title, message] =
				plan.reason === 'reserved'
					? [
							'Reserved name!',
							'Default preset is reserved.\nyou cannot rename it or rename other presets to it!'
						]
					: [
							$.Localize('#Customizer_Preset_Rename_Header'),
							$.Localize(
								plan.reason === 'exists' ? '#Customizer_Base_NameTaken' : '#Customizer_Base_NameInvalid'
							).replace('{name}', newName)
						];
			displayToast(title, message);
			return;
		}

		const done: Array<[string, string]> = [];
		for (const [from, to] of plan.renames) {
			if (this.panels.customizer.renameLayout(from, to)) {
				done.push([from, to]);
				continue;
			}

			for (const [renamedFrom, renamedTo] of done.toReversed()) {
				if (!this.panels.customizer.renameLayout(renamedTo, renamedFrom)) {
					$.Warning(`Failed to rename /cfg/hud/${renamedTo}.kv3 back to ${renamedFrom}.kv3`);
				}
			}
			this.presetList = new Set(this.panels.customizer.listLayouts());
			displayToast(
				$.Localize('#Customizer_Preset_Rename_Header'),
				$.Localize('#Customizer_Base_RenameFailed').replace('{file}', from)
			);
			return;
		}

		for (const [from, to] of done) {
			this.presetList.delete(from);
			this.presetList.add(to);

			// Gamemodes that had the old preset selected keep it selected under the new name
			const gamemodeID = gamemodeForPreset(from, ids);
			if (gamemodeID) {
				const key = `hud-customizer.preset.${gamemodeID}`;
				if ($.persistentStorage.getItem(key) === oldName) $.persistentStorage.setItem(key, newName);
			}
		}

		this.changePreset(newName);
		this.updatePresetSettings();
		displayInfoToast(
			$.Localize('#Customizer_Preset_Rename_Header'),
			$.Localize('#Customizer_Base_Renamed').replace('{old}', oldName).replace('{new}', newName)
		);
	}

	/** Deletes a preset of this gamemode, and its base too when `deleteBase` (the last preset of that name went). */
	deletePreset(name: string, deleteBase: boolean) {
		if (name === DEFAULT_PRESET) {
			displayToast('Preset not deleted!', 'You cannot delete the default preset!');
			return;
		}

		const fullPresetName = this.getFullPresetName(name);
		if (!this.panels.customizer.deleteLayout(fullPresetName)) {
			$.Warning(`Failed to delete /cfg/hud/${fullPresetName}.kv3`);
			return;
		}
		this.presetList.delete(fullPresetName);

		if (deleteBase) {
			const baseFile = BASE_FILE_PREFIX + name;
			if (this.panels.customizer.deleteLayout(baseFile)) this.presetList.delete(baseFile);
			else $.Warning(`Failed to delete /cfg/hud/${baseFile}.kv3`);
		}

		this.changePreset(DEFAULT_PRESET);
		this.updatePresetSettings();
	}

	/** The gamemodes a component exists in (every gamemode when it doesn't name any). */
	getComponentGamemodes(component: Component): GamemodeInfoProperties[] {
		const gamemodes = component.properties.gamemode;
		if (gamemodes === undefined || gamemodes === null) return [...GamemodeInfoList];
		return (Array.isArray(gamemodes) ? gamemodes : [gamemodes]).map((gamemode) => GamemodeInfo.get(gamemode));
	}

	/** Whether a registered component exists in the given gamemode. */
	isComponentAvailableIn(component: Component, gamemodeID: string): boolean {
		return this.getComponentGamemodes(component).some((info) => info?.id === gamemodeID);
	}

	copyPreset(presetList: { gamemodeID: string; presetName: string }[]) {
		this.save(false);

		const ids = Object.keys(this.components);
		for (const { gamemodeID, presetName } of presetList) {
			this.copyComponentsToPreset(gamemodeID, presetName, ids);
		}
	}

	copyPanelToOtherPresets(componentID: string, presetList: { gamemodeID: string; presetName: string }[]) {
		this.save(false);

		for (const { gamemodeID, presetName } of presetList) {
			this.copyComponentsToPreset(gamemodeID, presetName, [componentID]);
		}
	}

	/**
	 * Copies components of the current preset into another preset, leaving the target's other entries and its meta
	 * block alone. Only components that exist in the target's gamemode are copied. The target gets the values shown
	 * here as its own settings wherever they differ from its parent (its gamemode's shipped default and its base), so
	 * it looks like this preset.
	 * A target that follows a base uses the base's color profiles, so the ones the copied speedometers use are added
	 * to that base.
	 */
	copyComponentsToPreset(gamemodeID: string, presetName: string, ids: string[]): void {
		const raw = this.panels.customizer.loadLayout(this.getFullPresetName(presetName, gamemodeID));
		const target: PresetFile = raw ? splitPresetFile(raw) : { components: {} };
		const components: LayerObject = { ...target.components };
		const available = ids.filter((id) => this.isComponentAvailableIn(this.components[id], gamemodeID));

		const shipped = this.getShippedLayout(gamemodeID) as unknown as LayerObject;
		const targetBase = this.loadBase(presetName);
		const copied = cloneData(this.getCurrentLayoutForDelta());
		let base = targetBase?.layout ?? null;
		if (base && available.includes(SPEEDOMETER_PROFILES.component)) {
			base = this.addProfilesToNamedBase(presetName, base, targetBase.renames, copied);
		}

		const shown: LayerObject = {};
		for (const id of available) shown[id] = copied[id];
		const parent = resolvePreset(shipped, base, {}, targetBase?.renames ?? {}).parent;
		const explicit = explicitComponents(parent, shown, base !== null);
		for (const id of available) {
			if (explicit[id]) components[id] = explicit[id];
			else delete components[id];
		}

		if (!this.writePresetFile(presetName, { ...target, components }, gamemodeID)) return;

		$.persistentStorage.setItem(`hud-customizer.preset.${gamemodeID}`, presetName);
		this.updatePresetSettings();
	}

	/**
	 * Registers a HUD component with the customizer. This *must* be called after `HudCustomizer_Ready` fires, use with
	 * `registerHUDCustomizerComponent`!
	 * @see registerHUDCustomizerComponent
	 */
	loadComponent(panel: GenericPanel, properties: CustomizerComponentProperties): void {
		if (!panel) return;
		//Skip registering if the gamemode doesn't match. If the gamemode property doesn't exist always register
		if (properties.gamemode) {
			const allowed = Array.isArray(properties.gamemode) ? properties.gamemode : [properties.gamemode];
			if (!allowed.includes(this.gamemodeInfo.gamemode)) {
				panel.enabled = false;
				return;
			}
		}
		panel.enabled = true;

		const component = Component.register(panel, properties, (changed) => this.onComponentChanged(changed));

		//Skip registering if the component is missing from the default layout file
		if (!component) {
			$.Warning(`Could not register panel ${panel.id} because it's missing from the default layout file`);
			return;
		}

		this.components[component.id] = component;

		if (properties.events !== undefined) {
			const events = Array.isArray(properties.events) ? properties.events : [properties.events];
			events.forEach((event) => {
				$.RegisterEventHandler(event.event, event.panel as any, event.callbackFn);
			});
		}

		if (properties.unhandledEvents !== undefined) {
			const events = Array.isArray(properties.unhandledEvents)
				? properties.unhandledEvents
				: [properties.unhandledEvents];
			events.forEach((event) => {
				$.RegisterForUnhandledEvent(event.event, event.callbackFn);
			});
		}

		if (!this.reloading) this.generateComponentList();
	}

	/**
	 * Serializes all components and saves the current preset: per component, only the fields that differ from its
	 * parent (its base, or the shipped default without one). Entries of components that aren't registered in this
	 * gamemode are kept as they are.
	 * In a preset that follows a base, color profile edits are written to the base.
	 */
	save(showToast = true): void {
		if (this.currentPreset === DEFAULT_PRESET || !this.presetFile) return;

		const current = this.getCurrentLayoutForDelta();
		const savedBase = this.saveBaseStyles(current);
		if (savedBase === 'failed') {
			// The preset alone can't keep the profile edits (it follows the base's), so save nothing
			displayToast(
				$.Localize('#Customizer_Base_SaveFailed_Header'),
				$.Localize('#Customizer_Base_SaveFailed').replace('{base}', this.getBaseFileName())
			);
			return;
		}

		const previous = this.presetFile;
		const components: LayerObject = { ...previous.components };
		const explicit = explicitComponents(
			HudCustomizerHandler.parentLayout as unknown as LayerObject,
			current as unknown as LayerObject,
			this.baseLayout !== null
		);
		for (const id of Object.keys(current)) {
			if (explicit[id]) components[id] = explicit[id];
			else delete components[id];
		}

		const isNew = !this.presetList.has(this.getFullPresetName());
		const changed = isNew || !equalData(components, previous.components);
		if (!changed && savedBase === 'unchanged') return;

		if (changed && !this.writePresetFile(this.currentPreset, { ...previous, components })) return;

		this.presetFile = { ...previous, components };
		HudCustomizerHandler.presetLayout = current;
		if (showToast) this.showSavedToast();
	}

	/** File name of the current preset's base, base_<name> */
	getBaseFileName(preset: string = this.currentPreset): string {
		return BASE_FILE_PREFIX + preset;
	}

	/** Sets parentLayout; the explicit entries computed against the old one are dropped. */
	setParentLayout(parent: LayerObject): void {
		HudCustomizerHandler.parentLayout = parent as unknown as HudLayout;
		this.explicitEntries.clear();
	}

	/**
	 * In a preset that follows a base, writes edited base styles (color profiles) and profile renames into the base,
	 * and updates parentLayout so the preset stores no difference for them.
	 */
	saveBaseStyles(current: HudLayout): 'unchanged' | 'saved' | 'failed' {
		if (!this.baseLayout) return 'unchanged';

		const { component: id, style } = SPEEDOMETER_PROFILES;
		const base: LayerObject = { ...this.baseLayout };
		const edited = current[id]?.dynamicStyles?.[style];
		let changed = false;
		if (edited !== undefined && !equalData(edited, HudCustomizerHandler.parentLayout[id]?.dynamicStyles?.[style])) {
			const entry = { ...((base[id] as LayerObject | undefined) ?? {}) };
			entry.dynamicStyles = {
				...((entry.dynamicStyles as LayerObject | undefined) ?? {}),
				[style]: cloneData(edited)
			};
			base[id] = entry;
			changed = true;
		}

		// Renames that can't repoint anything anymore are dropped
		const renames = pruneRenames({ ...this.baseRenames, ...this.pendingRenames }, current[id]);
		this.pendingRenames = {};
		changed ||= !equalData(renames, this.baseRenames);

		if (!changed) return 'unchanged';
		if (!this.writeBaseFile(base, renames)) return 'failed';

		this.setParentLayout(
			resolvePreset(
				HudCustomizerHandler.defaultLayout as unknown as LayerObject,
				this.baseLayout,
				{},
				this.baseRenames
			).parent
		);
		return 'saved';
	}

	/** Writes base_<current preset> and keeps baseLayout up to date. */
	writeBaseFile(layout: LayerObject, renames: Record<string, string> = this.baseRenames): boolean {
		const data = serializeBaseFile(layout, renames);
		const fileName = this.getBaseFileName();
		const isSaved = this.panels.customizer.saveLayout(fileName, data as unknown as HudLayout);
		if (isSaved) {
			this.baseLayout = layout;
			this.baseRenames = renames;
			this.presetList.add(fileName);
		} else {
			$.Warning(`Failed to save /cfg/hud/${fileName}.kv3`);
		}
		return isSaved;
	}

	setBase(base: LoadedBase | null): void {
		this.baseLayout = base?.layout ?? null;
		this.baseRenames = base?.renames ?? {};
		this.pendingRenames = {};
	}

	/** Number of presets, in every gamemode, of the current profile name (they all follow its base). */
	getFollowerCount(): number {
		const files = profileFiles(this.getLayoutNames(), this.currentPreset, this.getGamemodeIDs());
		return new Set([...files.presets, this.getFullPresetName()]).size;
	}

	/**
	 * Apply to base for one component: opens the Position / Styles popup, naming the other presets of this name and
	 * the ones among them that have settings of their own for the component.
	 */
	confirmApplyToBase(component: Component): void {
		const name = component.properties.name;
		const others = profileFiles(this.getLayoutNames(), this.currentPreset, this.getGamemodeIDs()).presets.filter(
			(preset) => preset !== this.getFullPresetName()
		);
		const keeping = others.filter((preset) => {
			const raw = this.panels.customizer.loadLayout(preset);
			return raw && splitPresetFile(raw).components[component.id] !== undefined;
		});
		const none = $.Localize('#Customizer_Base_NoPresets');
		const message = $.Localize('#Customizer_Base_Apply_Message')
			.replaceAll('{panelName}', name)
			.replace('{base}', this.getBaseFileName())
			.replace('{followers}', others.join(', ') || none)
			.replace('{keeping}', keeping.join(', ') || none);

		this.showPartsPopup(
			$.Localize('#Customizer_Base_Apply'),
			message,
			$.Localize('#Customizer_Base_Apply'),
			(parts) => this.applyToBase([component.id], parts)
		);
	}

	/** The Position / Styles / Both popup used by Reset and Apply to base */
	showPartsPopup(title: string, message: string, okText: string, callback: (parts: LayerParts) => void): void {
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'ComponentParts',
			'file://{resources}/layout/modals/popups/hud-customizer-parts.xml',
			`title=${title}&message=${message}&okText=${okText}&callback=${UiToolkitAPI.RegisterJSCallback(callback)}`
		);
	}

	/** Use preset as base: every component's own settings go into the base. Asks first when the base exists. */
	confirmUsePresetAsBase(): void {
		if (this.currentPreset === DEFAULT_PRESET) return;
		const apply = () => this.applyToBase(Object.keys(this.components), { position: true, styles: true });
		if (!this.baseLayout) {
			apply();
			return;
		}
		UiToolkitAPI.ShowGenericPopupYesNo(
			$.Localize('#Customizer_Base_UsePreset'),
			$.Localize('#Customizer_Base_UsePreset_Confirm')
				.replace('{base}', this.getBaseFileName())
				.replace('{count}', String(this.getFollowerCount())),
			'',
			apply,
			() => UiToolkitAPI.CloseAllVisiblePopups()
		);
	}

	/**
	 * Moves the preset's own settings of `ids` (the ticked parts) into base_<name>, creating it if needed, merged over
	 * what the base has (see applyComponentToBase). The base is written first, then the preset, which looks exactly
	 * the same afterwards.
	 * A new base starts with the shipped color profiles plus the preset's own.
	 */
	applyToBase(ids: string[], parts: LayerParts): void {
		if (this.currentPreset === DEFAULT_PRESET || (!parts.position && !parts.styles)) return;

		this.save(false);
		const current = this.getCurrentLayoutForDelta();
		const defaults = HudCustomizerHandler.defaultLayout;
		const base: LayerObject = { ...(this.baseLayout ?? {}) };

		if (this.baseLayout === null) {
			// The preset's own color profiles join the shipped ones; its speedometers follow any renamed clash
			const styles = current.Speedometer?.dynamicStyles;
			const shipped = this.shippedBaseLayout.Speedometer?.dynamicStyles?.rangeColorProfiles;
			const merged = mergeColorProfiles(shipped, styles?.rangeColorProfiles, styles?.speedometers);
			if (styles?.speedometers !== undefined) styles.speedometers = merged.speedometers;
			if (styles) styles.rangeColorProfiles = merged.profiles;
			base.Speedometer = { dynamicStyles: { rangeColorProfiles: merged.profiles } };
		}

		const parent = HudCustomizerHandler.parentLayout;
		for (const id of ids) {
			if (!current[id]) continue;
			const entry = applyComponentToBase(id, base[id], parent[id], current[id], defaults[id], parts);
			if (entry) base[id] = entry;
			else delete base[id];
		}

		if (!this.writeBaseFile(base)) return;

		const newParent = resolvePreset(defaults as unknown as LayerObject, base, {}, this.baseRenames).parent;
		this.setParentLayout(newParent);
		const explicit = explicitComponents(newParent, current as unknown as LayerObject, true);
		const components: LayerObject = { ...this.presetFile!.components };
		for (const id of Object.keys(current)) {
			if (explicit[id]) components[id] = explicit[id];
			else delete components[id];
		}
		if (!this.writePresetFile(this.currentPreset, { ...this.presetFile!, components })) return;

		this.presetFile = { ...this.presetFile!, components };
		this.updateLayers();
		this.reloadLayout();
		this.updatePresetSettings();

		const names =
			ids.length === 1 ? this.components[ids[0]]?.properties.name : $.Localize('#Customizer_Base_AllPanels');
		displayInfoToast(
			$.Localize('#Customizer_Base_Apply'),
			$.Localize('#Customizer_Base_Applied')
				.replace('{panelName}', names)
				.replace('{base}', this.getBaseFileName())
		);
	}

	/** Whether base_<name> has settings for the component, besides its color profiles. */
	baseHasComponent(componentID: string): boolean {
		return withoutBaseStyles(componentID, this.baseLayout?.[componentID]) !== undefined;
	}

	/**
	 * Reset base to default for one component: removes it from base_<name>
	 * (keeping color profiles)
	 * , so every preset of that name without its own settings shows its gamemode's shipped component again.
	 */
	confirmResetBaseElement(component: Component): void {
		UiToolkitAPI.ShowGenericPopupYesNo(
			$.Localize('#Customizer_Base_ResetElement'),
			$.Localize('#Customizer_Base_ResetElement_Confirm')
				.replace('{panelName}', component.properties.name)
				.replace('{base}', this.getBaseFileName())
				.replace('{count}', String(this.getFollowerCount())),
			'',
			() => this.resetBaseElement(component),
			() => UiToolkitAPI.CloseAllVisiblePopups()
		);
	}

	resetBaseElement(component: Component): void {
		if (!this.baseHasComponent(component.id)) return;

		this.save(false);
		const base: LayerObject = { ...this.baseLayout };
		const entry = onlyBaseStyles(component.id, base[component.id]);
		if (entry) base[component.id] = entry;
		else delete base[component.id];
		if (!this.writeBaseFile(base)) return;

		this.updateLayers();
		this.reloadLayout();
		displayInfoToast(
			$.Localize('#Customizer_Base_ResetElement'),
			$.Localize('#Customizer_Base_ResetElement_Done')
				.replace('{panelName}', component.properties.name)
				.replace('{base}', this.getBaseFileName())
		);
	}

	/** A component's layout for diffing against layers: without `enabled` when the component can't be disabled. */
	getLayoutForDelta(component: Component): ComponentLayout {
		const layout = component.getLayout();
		if (component.properties.canDisable === false) delete (layout as Partial<ComponentLayout>).enabled;
		return layout;
	}

	/**
	 * The component's own settings in the current preset as it is now (unsaved edits included), undefined if none.
	 * Cached until the component or the preset's parent changes.
	 */
	getExplicitEntry(component: Component): LayerObject | undefined {
		if (this.currentPreset === DEFAULT_PRESET) return undefined;
		if (!this.explicitEntries.has(component.id)) {
			const layout = this.getLayoutForDelta(component);
			const parent = HudCustomizerHandler.parentLayout[component.id];
			const edited = this.baseLayout ? withBaseStyles(component.id, layout, parent) : layout;
			this.explicitEntries.set(component.id, componentLayerDelta(component.id, parent, edited));
		}
		return this.explicitEntries.get(component.id);
	}

	/**
	 * A component changed (a style, Reset, visibility). Its explicit entry is recomputed and its Apply to base button
	 * and divergence dots
	 * updated a moment later, once for a burst of changes such as dragging a slider.
	 */
	onComponentChanged(component: Component): void {
		this.explicitEntries.delete(component.id);
		if (!this.customizerReady) return;
		if (this.changedComponents.size === 0) {
			$.Schedule(0.1, () => {
				for (const changed of this.changedComponents) this.refreshDivergence(changed);
				this.changedComponents.clear();
			});
		}
		this.changedComponents.add(component);
	}

	/** Whether the preset stores its own value for a style, or for any style under it (see getExplicitEntry). */
	isStyleDiverged(component: Component, explicit: LayerObject | undefined, styleID: StyleID, depth = 0): boolean {
		// Children are listed by ID, so a style that lists itself (directly or not) would recurse forever
		if (!explicit || depth > 8) return false;
		if (hasExplicitStyle(component.id, explicit, styleID)) return true;
		const children = component.dynamicStyles?.[styleID]?.properties.children;
		return (Array.isArray(children) ? children : children ? [children] : []).some((child) =>
			this.isStyleDiverged(component, explicit, child.styleID, depth + 1)
		);
	}

	/**
	 * Updates the Apply to base button
	 * and the divergence dots
	 * of a component.
	 */
	refreshDivergence(component: Component): void {
		const explicit = this.getExplicitEntry(component);
		const applyButton = this.applyButtons.get(component.id);
		if (applyButton?.IsValid()) applyButton.enabled = canApply(explicit);

		if (component !== this.activeComponent) return;
		for (const [styleID, dot] of this.divergenceDots) {
			if (dot.IsValid()) dot.visible = this.isStyleDiverged(component, explicit, styleID);
		}
	}

	getFullPresetName(preset: string = this.currentPreset, gamemodeID: string = this.gamemodeInfo.id): string {
		return `${gamemodeID}_${preset}`;
	}

	/** Writes a preset file (of the current gamemode unless given) and keeps the preset list up to date. */
	writePresetFile(preset: string, file: PresetFile, gamemodeID: string = this.gamemodeInfo.id): boolean {
		const fullPresetName = this.getFullPresetName(preset, gamemodeID);
		const data = {
			...(file.meta && { meta: file.meta }),
			...file.components
		};

		const isSaved = this.panels.customizer.saveLayout(fullPresetName, data as unknown as HudLayout);
		if (isSaved) this.presetList.add(fullPresetName);
		return isSaved;
	}

	/** Loads and splits a preset file of the current gamemode. Null if it doesn't exist. */
	loadPresetFile(preset: string): PresetFile | null {
		if (preset === DEFAULT_PRESET) return null;
		const raw = this.panels.customizer.loadLayout(this.getFullPresetName(preset));
		return raw ? splitPresetFile(raw) : null;
	}

	/** Loads base_<name>, null if there is none. */
	loadBase(name: string): LoadedBase | null {
		if (name === DEFAULT_PRESET) return null;
		const raw = this.panels.customizer.loadLayout(BASE_FILE_PREFIX + name);
		if (!raw) return null;
		return { layout: parseBaseFile(raw), renames: parseBaseRenames(raw) };
	}

	/**
	 * Recomputes parentLayout and presetLayout from the loaded files: L0 + L1 (defaultLayout), the base (baseLayout)
	 * and the preset (presetFile). Does not touch the components, call reloadLayout() for that.
	 */
	updateLayers(): void {
		const defaults = HudCustomizerHandler.defaultLayout;

		if (this.currentPreset === DEFAULT_PRESET || !this.presetFile) {
			this.setParentLayout(defaults as unknown as LayerObject);
			HudCustomizerHandler.presetLayout = { ...defaults };
			return;
		}

		const { parent, resolved } = resolvePreset(
			defaults as unknown as LayerObject,
			this.baseLayout,
			this.presetFile.components,
			this.baseRenames
		);
		this.setParentLayout(parent);
		HudCustomizerHandler.presetLayout = resolved as unknown as HudLayout;
	}

	/** Current layouts of all registered components. */
	getCurrentLayout(): HudLayout {
		return Object.fromEntries(
			Object.entries(this.components).map(([id, component]) => [id, component.getLayout()])
		) as HudLayout;
	}

	/** {@link getCurrentLayout} as {@link getLayoutForDelta} gives it. */
	getCurrentLayoutForDelta(): HudLayout {
		return Object.fromEntries(
			Object.entries(this.components).map(([id, component]) => [id, this.getLayoutForDelta(component)])
		) as HudLayout;
	}

	enableEditing(): void {
		if (!this.customizerReady) return;

		if (!this.components || Object.keys(this.components).length === 0) {
			throw new Error("HudCustomizer: Tried to enable editing, but we weren't loaded!");
		}

		this.createResizeKnobs();

		this.activeComponent ??= this.components[Object.keys(this.components)[0]];
		this.panels.overlay.style.visibility = 'visible';

		this.setActiveComponent(this.activeComponent);
		this.updatePresetSettings();
		this.waitForActiveComponentLayouting();

		if (this.currentPreset !== undefined && this.currentPreset !== 'default') {
			this.defaultPresetStateOff();
		}
	}

	disableEditing(): void {
		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.dragPanel, this.dragStartHandle);
		}

		this.panels.overlay.style.visibility = 'collapse';
		// this.toggleSelectOnRightClick(false);
	}

	/**
	 * Toggles HUD customizer mode, taking control of user input.
	 *
	 * This is one of the few places where C++ does all the heavy lifting. Based on `enable`, it toggles the following:
	 * - Game input -- currently *handled* mouse events, and key inputs,
	 * - The `hud--customizer-enabled` class on the `<Hud />` panel,
	 * - `hittestchildren` on `<HudCustomizer />`,
	 * - Dispatches `HudCustomizer_OpenedInternal` or `HudCustomizer_Closed`.
	 */
	toggle(enable: boolean) {
		this.panels.customizer.toggleUI(enable);
	}

	isOpen(): boolean {
		return this.panels.customizer.isOpen();
	}

	defaultPresetStateOn() {
		this.panels.generalComponentContainer.style.visibility = 'collapse';
		this.panels.gamemodeComponentContainer.style.visibility = 'collapse';
		this.panels.activeComponentSettings.style.visibility = 'collapse';
		this.panels.dragPanel.style.visibility = 'collapse';
		this.panels.resizeKnobs.RemoveAndDeleteChildren();

		this.panels.presetSettingList.FindChildTraverse('PresetRename').enabled = false;
		this.panels.presetSettingList.FindChildTraverse('PresetDelete').enabled = false;

		this.disableEditing();
	}

	defaultPresetStateOff() {
		this.panels.generalComponentContainer.style.visibility = 'visible';
		this.panels.gamemodeComponentContainer.style.visibility = 'visible';
		this.panels.dragPanel.style.visibility = 'visible';

		this.panels.overlay.style.visibility = 'visible';

		this.panels.presetSettingList.FindChildTraverse('PresetRename').enabled = true;
		this.panels.presetSettingList.FindChildTraverse('PresetDelete').enabled = true;

		this.createResizeKnobs();

		if (this.customizerReady) {
			const customizerSettings = this.components['CustomizerSettings'];
			Component.register(customizerSettings.panel, customizerSettings.properties, (changed) =>
				this.onComponentChanged(changed)
			);
			this.panels.activeComponentSettings.style.visibility = 'visible';
		}

		$.Schedule(0.1, () => this.updateActiveComponentOverlayPosition());
	}

	generateComponentList() {
		// Infrequent and fast enough to just remake every time this changes.
		this.panels.generalComponentList.RemoveAndDeleteChildren();
		this.panels.gamemodeComponentList.RemoveAndDeleteChildren();
		this.applyButtons.clear();

		for (const [id, component] of Object.entries(this.components)) {
			const parent = component.properties.gamemode
				? this.panels.gamemodeComponentList
				: this.panels.generalComponentList;

			const panel = $.CreatePanel('RadioButton', parent, `${id}Settings`);
			panel.LoadLayoutSnippet('component');
			panel.SetDialogVariable('name', component.properties.name);
			panel.SetSelected(this.activeComponent === component);
			panel.SetPanelEvent('onactivate', () => this.setActiveComponentInternal(component));

			// These need unique IDs for tooltips to work so constructing via code instead of snippet. Grr.
			const right = panel.FindChild('Right')!;

			const availableGamemodes = this.getComponentGamemodes(component);

			if (availableGamemodes.length > 1) {
				const copyButton = $.CreatePanel('Button', right, `${id}CopyButton`, {
					class: 'hud-customizer-settings__component__button'
				});

				$.CreatePanel('Image', copyButton, '', { src: 'file://{images}/content-copy.svg' });
				copyButton.SetPanelEvent('onmouseover', () =>
					UiToolkitAPI.ShowTextTooltip(`${id}CopyButton`, $.Localize('#Customizer_Preset_Copy_PanelTooltip'))
				);
				copyButton.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());

				const header = $.Localize('#Customizer_Preset_Copy_PanelHeader').replace(
					'{panelName}',
					component.properties?.name
				);

				const copyButtonData = () => {
					return {
						title: header,
						gamemodes: availableGamemodes,
						presetList: this.getLayoutNames(),
						componentID: id,
						onConfirm: (componentID: string, presetList: { gamemodeID: string; presetName: string }[]) =>
							this.copyPanelToOtherPresets(componentID, presetList)
					} as CopyToOtherPresetsData;
				};

				copyButton.SetPanelEvent('onactivate', () =>
					UiToolkitAPI.ShowCustomLayoutPopupParameters(
						'CopyToOtherPresets',
						'file://{resources}/layout/modals/popups/hud-customizer-copy-to-other-presets.xml',
						`data=${UiToolkitAPI.RegisterJSCallback(() => copyButtonData())}`
					)
				);
			}

			if (this.currentPreset !== DEFAULT_PRESET) {
				// Apply to base: enabled while the panel has settings of its own in this preset
				const applyButton = $.CreatePanel('Button', right, `${id}ApplyBaseButton`, {
					class: 'hud-customizer-settings__component__button'
				});
				$.CreatePanel('Image', applyButton, '', { src: 'file://{images}/cloud-upload.svg' });
				setTooltip(
					applyButton,
					$.Localize('#Customizer_Base_Apply_Tooltip').replace('{base}', this.getBaseFileName())
				);
				applyButton.SetPanelEvent('onactivate', () => this.confirmApplyToBase(component));
				applyButton.enabled = canApply(this.getExplicitEntry(component));
				this.applyButtons.set(id, applyButton);

				// Reset base to default: only while the base has settings for the panel
				if (this.baseHasComponent(id)) {
					const resetBaseButton = $.CreatePanel('Button', right, `${id}ResetBaseButton`, {
						class: 'hud-customizer-settings__component__button hud-customizer-settings__component__button--base'
					});
					$.CreatePanel('Image', resetBaseButton, '', { src: 'file://{images}/eraser.svg' });
					setTooltip(
						resetBaseButton,
						$.Localize('#Customizer_Base_ResetElement_Tooltip').replace('{base}', this.getBaseFileName())
					);
					resetBaseButton.SetPanelEvent('onactivate', () => this.confirmResetBaseElement(component));
				}
			}

			const resetButton = $.CreatePanel('Button', right, `${id}ResetButton`, {
				class: 'hud-customizer-settings__component__button'
			});
			$.CreatePanel('Image', resetButton, '', { src: 'file://{images}/backup-restore.svg' });
			resetButton.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTextTooltip(`${id}ResetButton`, 'Reset'));
			resetButton.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
			resetButton.SetPanelEvent('onactivate', () => {
				const name = component.properties.name;
				this.showPartsPopup(
					`Reset ${name}`,
					`Are you sure you want to reset ${name}?`,
					'Reset Selected',
					(options: ResetOptions) => this.resetComponent(component, options)
				);
			});

			const visButton = $.CreatePanel('ToggleButton', right, `${id}VisButton`, {
				class: 'checkbox hud-customizer-settings__checkbox hud-customizer-settings__component__checkbox'
			});
			visButton.checked = component.enabled;
			visButton.SetPanelEvent('onmouseover', () =>
				UiToolkitAPI.ShowTextTooltip(`${id}VisButton`, 'Toggle Visibility')
			);
			visButton.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
			visButton.SetPanelEvent('onactivate', () => {
				component.enabled = visButton.checked;
				this.onComponentChanged(component);
			});
			visButton.enabled = component.properties.canDisable ?? true;
		}

		this.panels.gamemodeComponentContainer.SetHasClass(
			'hide',
			this.panels.gamemodeComponentList.GetChildCount() === 0
		);
	}

	setActiveComponent(component: Component): void {
		const componentRadioButton =
			this.panels.generalComponentList.FindChildTraverse<RadioButton>(`${component.id}Settings`) ??
			this.panels.gamemodeComponentList.FindChildTraverse<RadioButton>(`${component.id}Settings`);

		if (!componentRadioButton) {
			throw new Error(`HudCustomizer: Could not find component radio button for ${component.id}`);
		}

		// Handler already set up to for this activation to call setActiveComponentInternal
		$.DispatchEvent('Activated', componentRadioButton, PanelEventSource.MOUSE);
	}

	setActiveComponentInternal(component: Component): void {
		this.activeComponent = component;

		this.panels.overlay.SetDialogVariable('name', this.activeComponent.properties.name);
		this.updateActiveComponentOverlayPosition();
		this.updateActiveComponentSettings();
		this.updateActiveComponentDialogVars();

		// CSS handles visibility of appropriate knobs based on this
		this.panels.resizeKnobs.SetHasClass(
			'hud-customizer-overlay__resize-knobs--resize-x',
			component.properties.resizeX
		);
		this.panels.resizeKnobs.SetHasClass(
			'hud-customizer-overlay__resize-knobs--resize-y',
			component.properties.resizeY
		);

		// Set up drag handles
		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.dragPanel, this.dragStartHandle);
		}

		if (this.dragEndHandle) {
			$.UnregisterEventHandler('DragEnd', this.panels.dragPanel, this.dragEndHandle);
		}

		const canMove = component.properties.moveX !== false || component.properties.moveY !== false;

		this.panels.dragPanel.hittest = canMove;
		this.panels.dragPanel.SetDraggable(canMove);

		if (canMove) {
			this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.dragPanel, (...args) => {
				this.onStartDrag(DragMode.MOVE, this.panels.dragPanel, ...args);
			});

			this.dragEndHandle = $.RegisterEventHandler('DragEnd', this.panels.dragPanel, () => {
				this.onEndDrag();
			});
		}
	}

	updateActiveComponentOverlayPosition(): void {
		const component = this.activeComponent;

		if (!component) return;

		// If a width is provided in the config, use that. Otherwise, we let the component's size get set by
		// fit-children -- for lots of components this is essential.
		const width = component.width ?? LayoutUtil.getWidth(component.panel);
		const height = component.height ?? LayoutUtil.getHeight(component.panel);

		// Set the virtual panel's position and size to the component we just hovered over
		if (!component.dragPanel) {
			LayoutUtil.setPositionAndSize(
				this.panels.overlay,
				// Extra space around outer overlay so we can fit resize knobs and header
				component.offsetX - OVERLAY_MARGIN,
				component.offsetY - OVERLAY_MARGIN,
				width + OVERLAY_MARGIN * 2,
				height + OVERLAY_MARGIN * 2
			);

			LayoutUtil.setPositionAndSize(this.panels.dragPanel, component.offsetX, component.offsetY, width, height);
		} else {
			// We're using a sub-panel instead of whole component as drag target
			// You can't resize components with a sub-panel drag target so component offsets are fine.
			LayoutUtil.setPositionAndSize(
				this.panels.overlay,
				component.offsetX - OVERLAY_MARGIN,
				component.offsetY - OVERLAY_MARGIN,
				LayoutUtil.getWidth(component.dragPanel) + OVERLAY_MARGIN * 2,
				LayoutUtil.getHeight(component.dragPanel) + OVERLAY_MARGIN * 2
			);
			LayoutUtil.setPositionAndSize(
				this.panels.dragPanel,
				component.offsetX,
				component.offsetY,
				LayoutUtil.getWidth(component.dragPanel),
				LayoutUtil.getHeight(component.dragPanel)
			);
		}
	}

	updateActiveComponentSettings(): void {
		this.panels.activeComponentSettingsList.RemoveAndDeleteChildren();
		this.divergenceDots.clear();
		if (this.currentPreset === DEFAULT_PRESET) return;

		const resolveValue = (val: any) => {
			if (typeof val === 'string' && val.startsWith('$')) {
				const refKey = val.slice(1);
				return Component.referencedValues[refKey];
			}
			return val;
		};

		const component = this.activeComponent;

		if (!component || !component.dynamicStyles || Object.keys(component.dynamicStyles).length === 0) {
			this.panels.activeComponentSettings.visible = false;
			return;
		}

		this.panels.activeComponentSettings.visible = true;
		this.panels.settings.SetDialogVariable('active_name', component.properties.name);

		const explicit = this.getExplicitEntry(component);

		const childVisibilityMap = new Map<StyleID, Array<{ panel: Panel; showWhen?: any[] }>>();
		const refreshMap = new Map<StyleID, () => void>();

		const updateChildVisibility = (styleID: StyleID, newValue: any) => {
			const entries = childVisibilityMap.get(styleID);
			if (!entries) return;
			for (const { panel, showWhen } of entries) {
				if (showWhen !== undefined) {
					const normalized = Array.isArray(showWhen) ? showWhen : [showWhen];
					panel.style.visibility = normalized.includes(newValue) ? 'visible' : 'collapse';
				}
			}
		};

		const createStylePanel = (styleID: StyleID, dynamicStyle: DynamicStyle, parent: Panel) => {
			const panel = $.CreatePanel('Panel', parent, '');
			// Leaves room for the divergence dot on the left
			panel.AddClass('hud-customizer-settings__setting');

			if (
				dynamicStyle.properties.type !== CustomizerPropertyType.NONE &&
				dynamicStyle.properties.type !== CustomizerPropertyType.CUSTOM
			) {
				panel.AddClass('hud-customizer-settings__row-wrapper--hover');
			}

			if (dynamicStyle.properties.expandable) {
				const button = $.CreatePanel('Button', panel, 'ExpandArrowButton', {
					class: 'hud-customizer-settings__expand-arrow'
				});

				const arrow = $.CreatePanel('Image', button, 'ExpandArrow', {
					textureheight: 10,
					class: 'hud-customizer-settings__expand-arrow--image'
				});
				arrow.SetImage('file://{images}/down-arrow.svg');

				let expanded = false;
				button.SetPanelEvent('onactivate', () => {
					expanded = !expanded;
					arrow.SetHasClass('hud-customizer-settings__expand-arrow--expanded', expanded);

					const childrenWrapper = button.GetParent().GetParent().FindChild(`${styleID}Children`);
					childrenWrapper.SetHasClass('hud-customizer-settings__row-wrapper--children-hidden', !expanded);
				});
			}

			switch (dynamicStyle.properties.type) {
				case CustomizerPropertyType.NONE: {
					panel.LoadLayoutSnippet('dynamic-none');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);
					break;
				}

				case CustomizerPropertyType.NUMBER_ENTRY: {
					panel.LoadLayoutSnippet('dynamic-numberentry');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);
					const numberEntry = panel.FindChildTraverse<NumberEntry>('NumberEntry')!;

					if (dynamicStyle.properties.settingProps) {
						Object.assign(numberEntry, dynamicStyle.properties.settingProps);
					}

					const initialValue = resolveValue(component.dynamicStyles[styleID]?.value);
					numberEntry.value = (initialValue as number) ?? 0;

					numberEntry.SetPanelEvent('onvaluechanged', () => {
						component.setDynamicStyle(styleID, numberEntry.value);
						updateChildVisibility(styleID, numberEntry.value);

						// Wait for panorama to layout the panel in case the size changes, disgusting hack
						$.Schedule(0.1, () => this.updateActiveComponentOverlayPosition());
					});

					refreshMap.set(styleID, () => {
						numberEntry.value = (resolveValue(component.dynamicStyles[styleID]?.value) as number) ?? 0;
					});

					break;
				}

				case CustomizerPropertyType.CHECKBOX: {
					panel.LoadLayoutSnippet('dynamic-checkbox');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);
					const checkbox = panel.FindChildTraverse<ToggleButton>('Checkbox')!;

					if (dynamicStyle.properties.settingProps) {
						Object.assign(checkbox, dynamicStyle.properties.settingProps);
					}

					const initialValue = resolveValue(component.dynamicStyles[styleID]?.value);
					checkbox.checked = (initialValue as boolean) ?? false;

					checkbox.SetPanelEvent('onactivate', () => {
						component.setDynamicStyle(styleID, checkbox.checked);
						updateChildVisibility(styleID, checkbox.checked);

						// Wait for panorama to layout the panel in case the size changes
						$.Schedule(0.1, () => this.updateActiveComponentOverlayPosition());
					});

					refreshMap.set(styleID, () => {
						checkbox.checked = (resolveValue(component.dynamicStyles[styleID]?.value) as boolean) ?? false;
					});

					break;
				}

				case CustomizerPropertyType.SLIDER: {
					panel.LoadLayoutSnippet('dynamic-slider');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);
					const slider = panel.FindChildTraverse<Slider>('Slider')!;
					const textEntry = panel.FindChildTraverse<TextEntry>('Value')!;

					textEntry.text = component.dynamicStyles[styleID]?.value.toString() ?? 0;

					if (dynamicStyle.properties.settingProps) {
						Object.assign(slider, dynamicStyle.properties.settingProps);
					}

					slider.SetPanelEvent('onvaluechanged', () => {
						textEntry.text = slider.value.toFixed(0);

						component.setDynamicStyle(styleID, slider.value);
						updateChildVisibility(styleID, slider.value);

						// Wait for panorama to layout the panel in case the size changes
						$.Schedule(0.1, () => this.updateActiveComponentOverlayPosition());
					});

					textEntry.SetPanelEvent('ontextentrychange', () => {
						slider.value = +textEntry.text;

						component.setDynamicStyle(styleID, slider.value);
						updateChildVisibility(styleID, slider.value);

						// Wait for panorama to layout the panel in case the size changes
						$.Schedule(0.1, () => this.updateActiveComponentOverlayPosition());
					});

					refreshMap.set(styleID, () => {
						const newValue = resolveValue(component.dynamicStyles[styleID]?.value) as number;
						slider.value = newValue;
						textEntry.text = newValue.toFixed(0);
					});

					break;
				}

				case CustomizerPropertyType.DROPDOWN: {
					panel.LoadLayoutSnippet('dynamic-dropdown');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);
					const dropdown = panel.FindChildTraverse<DropDown>('DropDown')!;

					if (!dynamicStyle.properties.options?.length) {
						$.Warning(
							`HudCustomizer: DROPDOWN style '${styleID}' on component '${component.id}' has no options defined.`
						);
						break;
					}

					for (const option of dynamicStyle.properties.options) {
						const optionPanel = $.CreatePanel('Label', dropdown, option.value);
						optionPanel.text = option.label;
						dropdown.AddOption(optionPanel);
					}

					const initialValue = resolveValue(component.dynamicStyles[styleID]?.value);
					dropdown.SetSelected(initialValue as string);

					dropdown.SetPanelEvent('oninputsubmit', () => {
						const value = dropdown.GetSelected().id;
						component.setDynamicStyle(styleID, value);
						updateChildVisibility(styleID, value);

						// Wait for panorama to layout the panel in case the size changes
						$.Schedule(0.1, () => this.updateActiveComponentOverlayPosition());
					});

					refreshMap.set(styleID, () => {
						dropdown.SetSelected(resolveValue(component.dynamicStyles[styleID]?.value) as string);
					});

					break;
				}

				case CustomizerPropertyType.COLOR_PICKER: {
					panel.LoadLayoutSnippet('dynamic-colorpicker');

					const colorDisplay = panel.FindChildTraverse<ColorDisplay>('ColorDisplay')!;
					colorDisplay.text = dynamicStyle.properties.name;
					// We use hex for display here since it's more compact, but internally is rgba
					// since that's what PanoramaTypeToV8Param<Color> uses, don't want to change that.
					const initialValue = resolveValue(component.dynamicStyles[styleID]?.value);
					colorDisplay.color = (initialValue as rgbaColor) ?? 'rgba(255, 255, 255, 1)';

					colorDisplay.SetPanelEvent('oncolorchange', () => {
						const value = colorDisplay.color;
						component.setDynamicStyle(styleID, value);
						updateChildVisibility(styleID, value);
					});

					refreshMap.set(styleID, () => {
						colorDisplay.color =
							(resolveValue(component.dynamicStyles[styleID]?.value) as rgbaColor) ??
							'rgba(255, 255, 255, 1)';
					});

					break;
				}

				case CustomizerPropertyType.GRADIENT_PICKER: {
					panel.LoadLayoutSnippet('dynamic-gradientpicker');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);

					const initialValue = resolveValue(component.dynamicStyles[styleID]?.value);

					const startColor = panel.FindChildTraverse<ColorDisplay>('StartColor')!;
					startColor.text = 'From: ';
					startColor.color = (initialValue[0] as rgbaColor) ?? 'rgba(255, 255, 255, 1)';

					startColor.SetPanelEvent('oncolorchange', () => {
						const value = [startColor.color, endColor.color];
						component.setDynamicStyle(styleID, value);
						updateChildVisibility(styleID, value);
					});

					const endColor = panel.FindChildTraverse<ColorDisplay>('EndColor')!;
					endColor.text = 'To: ';
					endColor.color = (initialValue[1] as rgbaColor) ?? 'rgba(255, 255, 255, 1)';

					endColor.SetPanelEvent('oncolorchange', () => {
						const value = [startColor.color, endColor.color];
						component.setDynamicStyle(styleID, value);
						updateChildVisibility(styleID, value);
					});

					refreshMap.set(styleID, () => {
						const newValue = resolveValue(component.dynamicStyles[styleID]?.value);
						startColor.color = (newValue[0] as rgbaColor) ?? 'rgba(255, 255, 255, 1)';
						endColor.color = (newValue[1] as rgbaColor) ?? 'rgba(255, 255, 255, 1)';
					});

					break;
				}

				case CustomizerPropertyType.FONT_PICKER: {
					panel.LoadLayoutSnippet('dynamic-fontpicker');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);
					const dropdown = panel.FindChildTraverse<DropDown>('DropDown')!;

					for (const font of this.fonts) {
						const panel = $.CreatePanel('Label', dropdown, font);
						panel.text = font;

						// Disabled on linux because it causes extreme lag
						if (this.os === 'windows') {
							panel.style.fontFamily = `"${font}"`;
						}

						dropdown.AddOption(panel);
					}

					const initialValue = resolveValue(component.dynamicStyles[styleID]?.value);
					dropdown.SetSelected(initialValue as string);

					let value: string;
					dropdown.SetPanelEvent('oninputsubmit', () => {
						value = dropdown.GetSelected().id;
						component.setDynamicStyle(styleID, value);
						updateChildVisibility(styleID, value);
					});

					this.updateActiveComponentOverlayPosition();

					refreshMap.set(styleID, () => {
						dropdown.SetSelected(resolveValue(component.dynamicStyles[styleID]?.value) as string);
					});

					break;
				}

				case CustomizerPropertyType.CUSTOM: {
					panel.style.width = '100%';
					const body = $.CreatePanel('Panel', panel, '', { class: 'hud-customizer-settings__custom' });

					const api: CustomizerRenderApi = {
						isItemExplicit: (key: string) =>
							isKeyedItemExplicit(component.id, this.getExplicitEntry(component), styleID, key),
						...(isBaseStyle(component.id, styleID) && {
							getBaseName: () => (this.baseLayout ? this.getBaseFileName() : undefined),
							recordRename: (from: string, to: string) => {
								if (this.baseLayout && from !== to) this.pendingRenames[from] = to;
							}
						}),
						getValue: () => {
							// Deep clone so editors can't touch the stored value
							return cloneData(resolveValue(component.dynamicStyles[styleID]?.value) ?? null);
						},
						setValue: (value) => {
							component.setDynamicStyle(styleID, value);
							$.Schedule(0.1, () => this.updateActiveComponentOverlayPosition());
						}
					};

					const build = () => {
						body.RemoveAndDeleteChildren();
						dynamicStyle.properties.render?.(body, api);
					};

					build();
					refreshMap.set(styleID, build);
				}
			}

			if (dynamicStyle.properties.type !== CustomizerPropertyType.NONE || dynamicStyle.properties.children) {
				// Set in this preset rather than coming from its base / the shipped default. A group shows it when
				// anything inside it is, so it is seen while the group is collapsed
				const dot = $.CreatePanel('Panel', panel, '', { class: 'hud-customizer-settings__diverged' });
				setTooltip(dot, $.Localize('#Customizer_Base_DivergedMarker'));
				dot.visible = this.isStyleDiverged(component, explicit, styleID);
				this.divergenceDots.set(styleID, dot);
			}

			// Color profiles are only ever removed by deleting them in the profile editor
			if (dynamicStyle.properties.type !== CustomizerPropertyType.NONE && !isBaseStyle(component.id, styleID)) {
				panel.SetPanelEvent('oncontextmenu', () => {
					UiToolkitAPI.ShowSimpleContextMenu('', '', [
						{
							label: 'Reset Style',
							jsCallback: () => {
								component.resetSingle(styleID);
								refreshMap.get(styleID)?.();
								updateChildVisibility(styleID, resolveValue(component.dynamicStyles[styleID]?.value));
							}
						}
					]);
				});
			}

			return panel;
		};

		const childrenStyleIDs = new Set<StyleID>();

		for (const dynamicStyle of Object.values(component.dynamicStyles)) {
			const child = dynamicStyle.properties.children;
			if (child) {
				const normalized = Array.isArray(child) ? child : [child];
				for (const c of normalized) {
					childrenStyleIDs.add(c.styleID);
				}
			}
		}

		const appendChildren = (parentStyleID: StyleID, parentWrapper: Panel) => {
			const parentStyle = component.dynamicStyles[parentStyleID];
			const children = parentStyle.properties.children;
			if (children) {
				const normalizedChildren = Array.isArray(children) ? children : [children];

				const childrenWrapper = $.CreatePanel('Panel', parentWrapper, `${parentStyleID}Children`, {
					class: 'hud-customizer-settings__row-wrapper--has-children'
				});

				if (parentStyle.properties.expandable)
					childrenWrapper.AddClass('hud-customizer-settings__row-wrapper--children-hidden');

				for (const child of normalizedChildren) {
					const childStyle = component.dynamicStyles[child.styleID];
					if (!childStyle) {
						$.Warning(
							`Couldn't find child "${child.styleID}" on dynamic style "${parentStyleID}" in panel "${this.activeComponent.panel.id}"`
						);
						continue;
					}

					const childPanel = createStylePanel(child.styleID, childStyle, childrenWrapper);

					if (!childVisibilityMap.has(parentStyleID)) {
						childVisibilityMap.set(parentStyleID, []);
					}
					childVisibilityMap.get(parentStyleID)!.push({ panel: childPanel, showWhen: child.showWhen });

					if (child.showWhen !== undefined) {
						const parentValue = component.dynamicStyles[parentStyleID]?.value;
						const normalizedShowWhen = Array.isArray(child.showWhen) ? child.showWhen : [child.showWhen];
						childPanel.visible = normalizedShowWhen.includes(parentValue);
					}

					if (childStyle.properties.children) appendChildren(child.styleID, childrenWrapper);
				}
			}
		};

		// Generate settings based on CustomizerPropertyType
		for (const [styleID, dynamicStyle] of Object.entries(component.dynamicStyles)) {
			if (childrenStyleIDs.has(styleID)) continue;

			const wrapper = $.CreatePanel('Panel', this.panels.activeComponentSettingsList, 'ParentWrapper', {
				class: 'hud-customizer-settings__row-wrapper'
			});

			createStylePanel(styleID, dynamicStyle, wrapper);

			if (dynamicStyle.properties.children) appendChildren(styleID, wrapper);
		}
	}

	// Hacky stuff to wait for layouting to finish if needed. Hate doing this, but Panorama doesn't expose any
	// kind of event for layout traversal completion to JS (and I *really* don't want to add that, too low level).
	waitForActiveComponentLayouting(): void {
		const component = this.activeComponent;

		if (!component) return;

		const expectedW = component.properties.expectedMinWidth ?? 0;
		const expectedH = component.properties.expectedMinHeight ?? 0;
		if (component.properties.expectedMinWidth || component.properties.expectedMinHeight) {
			let w = component.panel.actuallayoutwidth ?? 0;
			let h = component.panel.actuallayoutheight ?? 0;
			let iters = 0;
			const handle = $.RegisterForUnhandledEvent('HudThink', () => {
				w = component.panel.actuallayoutwidth ?? 0;
				h = component.panel.actuallayoutheight ?? 0;
				iters++;
				if ((w >= expectedW && h >= expectedH) || iters > 500) {
					if (iters > 500) {
						$.Warning(
							`HudCustomizer: Expected size for component ${component.id} not reached after 500 frames! Killing HudThink handler.`
						);
					}

					this.updateActiveComponentOverlayPosition();
					$.UnregisterForUnhandledEvent('HudThink', handle);
				}
			});
		}
	}

	/** Reset: the preset's own settings of the component go, so it follows its base (or the shipped default) again. */
	resetComponent(component: Component, options: ResetOptions): void {
		component.reset(options);

		// Calling this ensures overlay panel and stuff get updated if you have the component selected already.
		// If you don't, you probably want it to be!
		this.setActiveComponent(component);
	}

	toggleSelectOnRightClick(enabled: boolean): void {
		for (const component of Object.values(this.components)) {
			const target = component.dragPanel ?? component.panel;
			if (enabled) target.SetPanelEvent('oncontextmenu', () => this.setActiveComponent(component));
			else target.ClearPanelEvent('oncontextmenu');
		}
	}

	onStartDrag(mode: DragMode, displayPanel: Panel, _panelID: string, callback: DragEventInfo) {
		if (!this.activeComponent) return;

		this.dragMode = mode;

		this.onThinkHandle = $.RegisterEventHandler('HudThink', this.panels.customizer, () => this.onDragThink());

		if (this.dragMode !== DragMode.MOVE) {
			// Ensures cursor and dragged resize knob remaining connected
			callback.offsetX = 0;
			callback.offsetY = 0;
		} else {
			this.panels.overlay.AddClass('hud-customizer-overlay--dragging');
		}

		callback.displayPanel = displayPanel;
		callback.removePositionBeforeDrop = false;
	}

	onDragThink(): void {
		if (!this.activeComponent || this.dragMode === undefined) return;

		if (this.dragMode === DragMode.MOVE) {
			// Update component JS position based on drag panel position, possibly snapping
			this.handleMoveSnapping();

			// Push updates to overlay, which isn't attached to drag panel either
			LayoutUtil.setPosition(
				this.panels.overlay,
				this.activeComponent.offsetX - OVERLAY_MARGIN,
				this.activeComponent.offsetY - OVERLAY_MARGIN
			);

			this.panels.overlay.SetHasClass(
				'hud-customizer-overlay--at-top',
				this.activeComponent.offsetY <= OVERLAY_MARGIN
			);
		} else {
			// Resize component JS size and position knob position, possibly snapping
			this.handleResizeSnapping();

			// Push updates to overlay. Drag panel will get updated on drag end
			LayoutUtil.setPosition(
				this.panels.overlay,
				this.activeComponent.offsetX - OVERLAY_MARGIN,
				this.activeComponent.offsetY - OVERLAY_MARGIN
			);

			if (this.activeComponent.width !== undefined) {
				LayoutUtil.setWidth(this.panels.overlay, this.activeComponent.width + OVERLAY_MARGIN * 2);
			}

			if (this.activeComponent.height !== undefined) {
				LayoutUtil.setHeight(this.panels.overlay, this.activeComponent.height + OVERLAY_MARGIN * 2);
			}
		}

		this.updateActiveComponentDialogVars();
	}

	onEndDrag() {
		if (!this.activeComponent) return;

		if (this.onThinkHandle == null) {
			throw new Error('onEndDrag called with invalid handler somehow');
		}

		// Call the last think to ensure the final position is set
		this.onDragThink();

		$.UnregisterEventHandler('HudThink', this.panels.customizer, this.onThinkHandle);

		LayoutUtil.setPosition(this.panels.dragPanel, this.activeComponent.offsetX, this.activeComponent.offsetY);

		// TODO: This doesn't work when styles are defined in css, they must be defined in-line
		// Maybe a better idea is to use minExpectedWidth and minExpectedHeight for this?
		// It's not used on any panel right now so it can wait
		const [minWidth, minHeight] = getMinSize(this.activeComponent.panel);
		if (this.activeComponent.width !== undefined) {
			LayoutUtil.setWidth(this.panels.dragPanel, Math.max(this.activeComponent.width, minWidth));
		}
		if (this.activeComponent.height !== undefined) {
			LayoutUtil.setHeight(this.panels.dragPanel, Math.max(this.activeComponent.height, minHeight));
		}

		this.panels.overlay.RemoveClass('hud-customizer-overlay--dragging');

		this.activeGridlines?.forEach((line) => line?.panel.RemoveClass('hud-customizer-grid__line--highlight'));
		this.activeGridlines = [undefined, undefined];

		this.dragMode = undefined;

		this.onComponentChanged(this.activeComponent);
	}

	handleMoveSnapping(): void {
		if (!this.activeComponent) return;

		const shouldSnap = this.enableSnapping;

		for (const axis of Axes) {
			if (axis === Axis.X && this.activeComponent.properties.moveX === false) continue;
			if (axis === Axis.Y && this.activeComponent.properties.moveY === false) continue;

			const gridGapLength = this.getGridGapLength(axis);
			const panelPos = LayoutUtil.getPosition(this.panels.dragPanel)[axis];
			const panelSize = LayoutUtil.getSize(this.panels.dragPanel)[axis];
			const panelRightPos = panelPos + panelSize;

			// Centering takes precendence, if we can center within thresold of SNAPPING_THRESHOLD, do that
			const centerPos = panelPos + panelSize / 2;
			const centerGridline = this.gridlines[axis][Math.floor(this.gridlines[axis].length / 2)];
			const centerDist = Math.abs(centerGridline.offset - centerPos);
			if (shouldSnap && centerDist <= CENTER_SNAPPING_THRESHOLD * gridGapLength) {
				this.activeComponent[axis === Axis.X ? 'offsetX' : 'offsetY'] = centerGridline.offset - panelSize / 2;
				this.setActiveGridline(axis, centerGridline);
				continue;
			}

			// Not centering, do normal left/right edge snapping
			// If left or right are within snapStrength * gridGapLength of a gridline, snap to it
			// If both left and right are within snap range, snap to the closest one
			let leftIndex: number | undefined;
			let rightIndex: number | undefined;

			if (shouldSnap) {
				for (let i = 0; i < this.gridlines[axis].length; i++) {
					const gl = this.gridlines[axis][i];
					if (Math.abs(gl.offset - panelPos) <= SNAPPING_THRESHOLD * gridGapLength) {
						leftIndex = i;
						break;
					}
				}

				for (let i = 0; i < this.gridlines[axis].length; i++) {
					const gl = this.gridlines[axis][i];
					if (Math.abs(gl.offset - panelRightPos) <= SNAPPING_THRESHOLD * gridGapLength) {
						rightIndex = i;
						break;
					}
				}
			}

			// Nothing to snap, set to wherever the drag panel is
			if (leftIndex === undefined && rightIndex === undefined) {
				this.activeComponent[axis === Axis.X ? 'offsetX' : 'offsetY'] = LayoutUtil.getPosition(
					this.panels.dragPanel
				)[axis];
				this.setActiveGridline(axis, undefined);
				continue;
			}

			if (leftIndex !== undefined && rightIndex !== undefined) {
				// Both sides are in range, snap to the closest
				const leftDist = Math.abs(this.gridlines[axis][leftIndex].offset - panelPos);
				const rightDist = Math.abs(this.gridlines[axis][rightIndex].offset - panelRightPos);
				if (leftDist <= rightDist) {
					rightIndex = undefined;
				} else {
					leftIndex = undefined;
				}
			}

			if (leftIndex !== undefined) {
				this.activeComponent[axis === Axis.X ? 'offsetX' : 'offsetY'] = this.gridlines[axis][leftIndex].offset;
				this.setActiveGridline(axis, this.gridlines[axis][leftIndex]);
			} else {
				this.activeComponent[axis === Axis.X ? 'offsetX' : 'offsetY'] =
					this.gridlines[axis][rightIndex!].offset - panelSize;
				this.setActiveGridline(axis, this.gridlines[axis][rightIndex!]);
			}
		}
	}

	setActiveGridline(axis: Axis, gridline: Gridline | undefined): void {
		const activeGridline = this.activeGridlines[axis];

		if (gridline !== activeGridline) {
			if (activeGridline) {
				activeGridline.panel.RemoveClass('hud-customizer-grid__line--highlight');
			}

			if (gridline) {
				gridline.panel.AddClass('hud-customizer-grid__line--highlight');
			}

			this.activeGridlines[axis] = gridline;
		}
	}

	updateActiveComponentDialogVars(): void {
		if (!this.activeComponent) return;

		this.panels.overlay.SetDialogVariable('x', this.activeComponent.offsetX.toFixed(2));
		this.panels.overlay.SetDialogVariable('y', this.activeComponent.offsetY.toFixed(2));
		this.panels.overlay.SetDialogVariable(
			'width',
			this.activeComponent.width ? this.activeComponent.width.toFixed(2) : 'fit'
		);
		this.panels.overlay.SetDialogVariable(
			'height',
			this.activeComponent.height ? this.activeComponent.height.toFixed(2) : 'fit'
		);
	}

	readonly ResizeVectors = {
		[DragMode.RESIZE_TOP]: [0, -1],
		[DragMode.RESIZE_TOP_RIGHT]: [1, -1],
		[DragMode.RESIZE_RIGHT]: [1, 0],
		[DragMode.RESIZE_BOTTOM_RIGHT]: [1, 1],
		[DragMode.RESIZE_BOTTOM]: [0, 1],
		[DragMode.RESIZE_BOTTOM_LEFT]: [-1, 1],
		[DragMode.RESIZE_LEFT]: [-1, 0],
		[DragMode.RESIZE_TOP_LEFT]: [-1, -1]
	};

	handleResizeSnapping(): void {
		if (!this.activeComponent || this.dragMode === undefined) return;

		const shouldSnap = this.enableSnapping;

		const [resizeX, resizeY] = this.ResizeVectors[this.dragMode] ?? [0, 0];
		const [knobX, knobY] = LayoutUtil.getPosition(this.panels.dragResizeKnob);
		const [minWidth, minHeight] = getMinSize(this.activeComponent.panel);

		// Possible to make this code shorter by indexing into X,Y, W/H tuples but gets confusing, and important
		// that offsetX, offsetY, width and height setters are actually called, not just the underlying arrays modified;
		// otherwise the panel doesn't update.

		// TODO: If panel is below minsize, stop setting gridline
		// Also, do we really want minSize set in CSS, or should we do a customizer property thing? Maybe default
		// to something very small (to disallow making buggy components with 0 width/height, then allow overriding?
		if (this.activeComponent.width) {
			const gridGapWidth = this.getGridGapLength(Axis.X);
			const offsetX = this.activeComponent.offsetX;
			let newX = knobX;

			if (shouldSnap) {
				for (const gl of this.gridlines[Axis.X]) {
					const dist = Math.abs(gl.offset - knobX);
					if (dist <= SNAPPING_THRESHOLD * gridGapWidth) {
						newX = gl.offset;
						this.setActiveGridline(Axis.X, gl);
						break;
					}
				}
			} else {
				this.setActiveGridline(Axis.X, undefined);
			}

			if (resizeX === 1) {
				this.activeComponent.width = Math.max(newX - offsetX, minWidth);
			} else if (resizeX === -1) {
				this.activeComponent.width = this.activeComponent.width + this.activeComponent.offsetX - newX;
				const minWidthOffset = Math.max(this.activeComponent.width, minWidth) - this.activeComponent.width;
				this.activeComponent.width += minWidthOffset;
				this.activeComponent.offsetX = newX - minWidthOffset;
			}
		}

		if (this.activeComponent.height) {
			const gridGapHeight = this.getGridGapLength(Axis.Y);
			const offsetY = this.activeComponent.offsetY;
			let newY = knobY;

			if (shouldSnap) {
				for (const gl of this.gridlines[Axis.Y]) {
					const dist = Math.abs(gl.offset - knobY);
					if (dist <= SNAPPING_THRESHOLD * gridGapHeight) {
						newY = gl.offset;
						this.setActiveGridline(Axis.Y, gl);
						break;
					}
				}
			} else {
				this.setActiveGridline(Axis.Y, undefined);
			}

			if (resizeY === 1) {
				this.activeComponent.height = Math.max(newY - offsetY, minHeight);
			} else if (resizeY === -1) {
				this.activeComponent.height = this.activeComponent.height + this.activeComponent.offsetY - newY;
				const minHeightOffset = Math.max(this.activeComponent.height, minHeight) - this.activeComponent.height;
				this.activeComponent.height += minHeightOffset;
				this.activeComponent.offsetY = newY - minHeightOffset;
			}
		}
	}

	createGridLines(gridSize: number): void {
		this.panels.grid.RemoveAndDeleteChildren();

		const numXLines = this.snapToEvenMin2(2 ** gridSize);
		const numYLines = this.snapToEvenMin2(numXLines * (9 / 16));

		this.gridlines = [[], []];
		this.activeGridlines = [undefined, undefined];

		for (const axis of Axes) {
			const isX = axis === 0;
			const numLines = isX ? numXLines : numYLines;
			const totalLength = isX ? VIRTUAL_WIDTH : DEFAULT_HEIGHT;

			this.gridlines[axis] = Array.from({ length: numLines + 1 }, (_, i) => {
				const offset = Math.round(totalLength * (i / numLines));

				let cssClass = `hud-customizer-grid__line hud-customizer-grid__line--${isX ? 'x' : 'y'}`;
				if (i === numLines / 2) {
					cssClass += ' hud-customizer-grid__line--center';
				}
				if (i === 0 || i === numLines) {
					cssClass += ' hud-customizer-grid__line--edge';
				}

				const gridline = $.CreatePanel('Panel', this.panels.grid, '', { class: cssClass });

				if (isX) {
					LayoutUtil.setPosition(gridline, offset, 0);
				} else {
					LayoutUtil.setPosition(gridline, 0, offset);
				}

				return {
					panel: gridline,
					offset
				};
			});
		}
	}

	getGridGapLength(axis: Axis): number {
		const lines = this.gridlines[axis];
		return lines[1].offset - lines[0].offset;
	}

	snapToEvenMin2(value: number): number {
		const n = Math.max(2, Math.round(value));
		return n % 2 === 0 ? n : n + 1;
	}

	createResizeKnobs(): void {
		if (this.currentPreset === 'default') return;
		this.resizeKnobs = {} as Record<any, any>;
		this.panels.resizeKnobs.RemoveAndDeleteChildren();

		Enum.fastValuesNumeric(DragMode)
			.filter((dir) => dir !== DragMode.MOVE) // handled in onComponentMouseOver
			.forEach((dir) => {
				const knob = $.CreatePanel('Button', this.panels.resizeKnobs, `Resize_${DragMode[dir]}`, {
					class:
						'hud-customizer-overlay__resize-knobs__knob ' +
						`hud-customizer-overlay__resize-knobs__knob${DragMode[dir].toLowerCase().replaceAll('resize_', '--').replace('_', '-')}`,
					draggable: true,
					hittest: true,
					hittestchildren: false
				});

				// Inner panel with background, slightly smaller than panel
				$.CreatePanel('Panel', knob, '');

				$.RegisterEventHandler('DragStart', knob, (...args) => {
					this.onStartDrag(dir, this.panels.dragResizeKnob, ...args);
				});
				$.RegisterEventHandler('DragEnd', knob, () => {
					this.onEndDrag();
				});

				this.resizeKnobs[dir] = knob;
			});
	}

	/** The shipped layout of a gamemode, base_default + <mode>_default (L0 + L1). */
	getShippedLayout(gamemodeID: string): HudLayout {
		if (Object.keys(this.shippedBaseLayout).length === 0) {
			throw new Error(`Could not load ${BASE_FILE_PREFIX + DEFAULT_PRESET}.kv3 from /cfg/hud`);
		}
		const gamemodeLayout = $.GetContextPanel<HudCustomizer>().loadLayout(`${gamemodeID}_${DEFAULT_PRESET}`);
		if (!gamemodeLayout) {
			throw new Error(`Could not load ${gamemodeID}_${DEFAULT_PRESET}.kv3 from /cfg/hud`);
		}

		// Gamemode defaults may store list deltas on base_default's lists (e.g. KZ adds the jump speedometer)
		return resolveLayers([
			this.shippedBaseLayout as unknown as LayerObject,
			gamemodeLayout as unknown as LayerObject
		]) as unknown as HudLayout;
	}

	/** Loads the layers of the preset persistent storage has selected for this gamemode. Needs shippedBaseLayout. */
	initializeLayouts() {
		const gamemodeID = this.gamemodeInfo.id;
		const preset = $.persistentStorage.getItem(`hud-customizer.preset.${gamemodeID}`) as string;

		HudCustomizerHandler.defaultLayout = this.getShippedLayout(gamemodeID);

		const presetFile = preset && preset !== DEFAULT_PRESET ? this.loadPresetFile(preset) : null;
		if (preset && preset !== DEFAULT_PRESET && !presetFile) {
			$.persistentStorage.setItem(`hud-customizer.preset.${gamemodeID}`, DEFAULT_PRESET);
			$.Warning(`Could not load ${gamemodeID}_${preset}.kv3 from /cfg/hud`);
		}

		this.currentPreset = presetFile ? preset : DEFAULT_PRESET;
		this.presetFile = presetFile;
		this.setBase(presetFile ? this.loadBase(preset) : null);

		this.updateLayers();
	}
}

/** A loaded base_<name> file */
interface LoadedBase {
	layout: LayerObject;
	renames: Record<string, string>;
}

/** Shows `text` as the panel's tooltip while hovered */
function setTooltip(panel: GenericPanel, text: string): void {
	panel.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTextTooltipOnPanel(panel, text));
	panel.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
}

function parsePx(str: string): number | undefined {
	if (str?.slice(-2) === 'px') {
		return Number.parseFloat(str.slice(0, -2));
	}
	return undefined;
}

function getMinSize(panel: GenericPanel): [number, number] {
	return [parsePx(panel.style.minWidth) ?? MINIMUM_PANEL_SIZE, parsePx(panel.style.minHeight) ?? MINIMUM_PANEL_SIZE];
}

/** CSS-style panel lookup utility */
function cssPanelLookup<T extends Panel>(panel: GenericPanel, selector: QuerySelector): T | T[] | null {
	if (selector.startsWith('#')) {
		return panel.FindChildTraverse(selector.slice(1)) as T | null;
	} else if (selector.startsWith('.')) {
		return panel.FindChildrenWithClassTraverse(selector.slice(1)) as T[] | null;
	} else {
		return traverseChildren(panel)
			.filter((p) => p.paneltype === selector)
			.toArray() as T[];
	}
}

function displayToast(title: string, message: string) {
	ToastAPI.CreateToast('', title, message, 2, 10, '', 'red');
}

function displayInfoToast(title: string, message: string) {
	ToastAPI.CreateToast('', title, message, 2, 5, '', 'blue');
}

/** Whether a component's own settings hold anything Apply to base moves (visibility doesn't move) */
function canApply(explicit: LayerObject | undefined): boolean {
	return pickParts(explicit, { position: true, styles: true }) !== undefined;
}
