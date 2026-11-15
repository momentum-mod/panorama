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
import { GamemodeInfo, GamemodeInfoList } from 'common/gamemode';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import { PanelHandler } from 'util/module-helpers';
import { mergeDeep, compareDeepIgnoreNull, compareDeepAsymmetric } from 'util/functions';
import { importLegacySpeedometers } from 'common/speedometer-legacy-import';
import { CopyToOtherPresetsData } from 'modals/popups/hud-customizer-copy-to-other-presets';
import {
	BASE_FILE_PREFIX,
	cloneData,
	equalData,
	EXPORT_FILE_PREFIX,
	gamemodeIDForFile,
	isPinned,
	isReservedLayoutName,
	LayerObject,
	parseBaseFile,
	PINNED_KEY,
	PresetFile,
	serializeBaseFile,
	splitPresetFile,
	withoutPinned
} from 'common/hud-layers';
import {
	componentLayerDelta,
	GLOBAL_STYLES,
	KEYED_LISTS,
	keyOf,
	KeyedListSpec,
	materializeLayer,
	resolveEntry,
	resolveLayers,
	updateBaseComponentEntry,
	withGlobalStyles,
	withoutGlobalStyles
} from 'common/hud-keyed-lists';
import { mergeColorProfilesIntoGlobal } from 'common/speedometer';

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

export type ResetOptions = { position: boolean; styles: boolean };

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

	/** @see registerHUDCustomizerComponent */
	static register(panel: GenericPanel, properties: CustomizerComponentProperties): Component {
		if (!HudCustomizerHandler.defaultLayout[panel.id]) return null;
		return new Component(panel, properties);
	}

	private constructor(panel: GenericPanel, properties: CustomizerComponentProperties) {
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

	/** Reset a component to the layer below the one being edited (the base, or the shipped default). */
	reset(options: ResetOptions): void {
		const defaultComponentLayout = HudCustomizerHandler.parentLayout[this.id];
		if (!defaultComponentLayout)
			throw new Error(`HudCustomizer: Could not load default layout for HUD customizer component ${this.id}`);

		if (options.styles) {
			this.width = defaultComponentLayout.width ?? undefined;
			this.height = defaultComponentLayout.height ?? undefined;

			for (const [styleID, dynamicStyle] of Object.entries(this.dynamicStyles ?? {})) {
				const defaultValue = defaultComponentLayout.dynamicStyles?.[styleID];
				if (defaultValue !== undefined) {
					dynamicStyle.value = defaultValue;
					this.applyDynamicStyle(dynamicStyle);
				}
			}
		}

		if (options.position) {
			this.offsetX = this.getScaledOffsetX(defaultComponentLayout.offsetX);
			this.offsetY = defaultComponentLayout.offsetY;
		}

		this.properties.postInit?.();
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

	presetList: Set<string>;
	unsavedPresets: Set<string> = new Set();

	/** What the components show: the resolved layout of the current edit target */
	static presetLayout: HudLayout;
	/** Shipped layout of the current gamemode, hud_default + <mode>_default (L0 + L1) */
	static defaultLayout: HudLayout;
	/** What the current edit target is saved relative to, and what Reset goes back to */
	static parentLayout: HudLayout;

	/**
	 * Name of the base profile, cfg/hud/base_<name>.kv3. One global base for now; presets store the name they follow
	 * so several named bases can be added later without changing the file format.
	 */
	readonly baseName = 'main';
	/** The base profile's component deltas on L0 + L1 (L2), null if the base file doesn't exist */
	baseLayout: LayerObject | null = null;
	/** The current preset file as stored (L3). Null for the default preset and for presets not saved yet */
	presetFile: PresetFile | null = null;
	/** Whether edits go to the current preset or to the base profile (all modes) */
	editTarget: 'preset' | 'base' = 'preset';

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

			// One-time import of the legacy speedometer files, may create presets and select them
			if (importLegacySpeedometers(this.panels.customizer)) {
				this.presetList = new Set(this.panels.customizer.listLayouts());
			}

			this.updatePresetSettings();
			this.initializeLayouts();

			if (this.currentPreset === 'default') {
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
	// They can be referenced in hud_default.kv3 by using a string formatted like this: "$someStyleID"
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

			const gamemodeIDs = GamemodeInfoList.map((info) => info.id);
			const getGamemodeForFile = (name: string) =>
				isReservedLayoutName(name) ? undefined : gamemodeIDForFile(name, gamemodeIDs);

			// Filters presetList + this.unsavedPresets to only those that match gamemodeID_<name> pattern, then strips gamemodeID + _
			// Sorts by name except for default which is always at the top
			const presets = [...this.presetList, ...this.unsavedPresets]
				.filter((name) => getGamemodeForFile(name) === gamemodeID)
				.map((name) => name.slice(gamemodeID.length + 1))
				.sort((a, b) => {
					if (a === 'default') return -1;
					if (b === 'default') return 1;
					return a.localeCompare(b);
				});

			for (const preset of presets) {
				const optionPanel = $.CreatePanel('Label', dropdown, preset);
				optionPanel.text = preset;
				dropdown.AddOption(optionPanel);
			}

			dropdown.SetSelected(this.currentPreset ?? 'default');

			dropdown.SetPanelEvent('oninputsubmit', () => {
				//Attempt to save when changing presets
				if (this.customizerReady) this.save();

				const value = dropdown.GetSelected().id;
				this.changePreset(value);
			});
		};

		const createButtons = (parent: GenericPanel) => {
			const panel = $.CreatePanel('Panel', parent, '');
			panel.LoadLayoutSnippet('preset-buttons');

			const isDefaultPreset = this.currentPreset === 'default';

			const createPreset = panel.FindChild('PresetCreateNew');
			const createPresetLabel = createPreset.GetFirstChild() as Label;
			createPresetLabel.text = $.Localize('#Customizer_Preset_CreateNew');

			createPreset.SetPanelEvent('onactivate', () => {
				UiToolkitAPI.ShowCustomLayoutPopupParameters(
					'CreateNewPreset',
					'file://{resources}/layout/modals/popups/hud-customizer-layout-name.xml',
					`title=${$.Localize('#Customizer_Preset_CreateNew_Header')}&input_label=${$.Localize('#Customizer_Preset_CreateNew_InputLabel')}&ok_btn_label=${$.Localize('#Customizer_Preset_CreateNew')}&callback=${UiToolkitAPI.RegisterJSCallback(
						(name: string) => {
							this.save();
							this.createNewPreset(name);
						}
					)}`
				);
			});

			const renamePreset = panel.FindChild('PresetRename');
			const renamePresetLabel = renamePreset.GetFirstChild() as Label;
			renamePresetLabel.text = $.Localize('#Customizer_Preset_Rename');

			renamePreset.enabled = !isDefaultPreset;

			const renamePresetInputLabel = $.Localize('#Customizer_Preset_Rename_InputLabel').replace(
				'{currentPreset}',
				this.currentPreset
			);

			renamePreset.SetPanelEvent('onactivate', () => {
				UiToolkitAPI.ShowCustomLayoutPopupParameters(
					'RenamePreset',
					'file://{resources}/layout/modals/popups/hud-customizer-layout-name.xml',
					`title=${$.Localize('#Customizer_Preset_Rename_Header')}&input_label=${renamePresetInputLabel}&ok_btn_label=${$.Localize('#Customizer_Preset_Rename')}&callback=${UiToolkitAPI.RegisterJSCallback(
						(name: string) => this.renamePreset(this.currentPreset, name)
					)}`
				);
			});

			const deletePreset = panel.FindChild('PresetDelete');
			const deletePresetLabel = deletePreset.GetFirstChild() as Label;
			deletePresetLabel.text = $.Localize('#Common_Delete');

			deletePreset.enabled = !isDefaultPreset;

			let deletePresetPopupLabel = $.Localize('#Customizer_Preset_Delete_PopupLabel');
			deletePresetPopupLabel = deletePresetPopupLabel.replace('{currentPreset}', this.currentPreset);

			deletePreset.SetPanelEvent('onactivate', () => {
				UiToolkitAPI.ShowGenericPopupYesNo(
					`${$.Localize('#Customizer_Preset_Delete_Header')}`,
					deletePresetPopupLabel,
					'',
					() => this.deletePreset(this.currentPreset),
					() => UiToolkitAPI.CloseAllVisiblePopups()
				);
			});

			const copyPresetData = () => {
				return {
					title: $.Localize('#Customizer_Preset_Copy_Header'),
					gamemodes: GamemodeInfoList,
					presetList: [...this.presetList, ...this.unsavedPresets],
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

	/** Base profile controls under the preset buttons: edit target and detach, or "use base" for detached presets. */
	createBaseControls(parent: GenericPanel): void {
		this.panels.settings.SetHasClass('hud-customizer-settings--base-edit', this.editTarget === 'base');

		const buttonRow = $.CreatePanel('Panel', parent, '', {
			class: 'hud-customizer-settings__row mt-2 h-fit-children'
		});
		const addButton = (id: string, token: string, tooltipToken: string, onActivate: () => void, cls = '') => {
			const button = $.CreatePanel('Button', buttonRow, id, {
				class: `button hud-customizer-settings__button px-2 py-1 ${cls}`
			});
			$.CreatePanel('Label', button, '', { text: $.Localize(token) });
			button.SetPanelEvent('onactivate', onActivate);
			button.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTextTooltip(id, $.Localize(tooltipToken)));
			button.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
		};

		if (this.currentPreset !== 'default') {
			if (this.isAttached()) {
				addButton('PresetDetachBase', '#Customizer_Base_Detach', '#Customizer_Base_Detach_Tooltip', () =>
					this.detachFromBase()
				);
			} else {
				addButton('PresetUseBase', '#Customizer_Base_Attach', '#Customizer_Base_Attach_Tooltip', () =>
					this.attachToBase()
				);
			}
		}

		// Pushes export / import to the right
		const spacer = $.CreatePanel('Panel', buttonRow, '');
		spacer.style.width = 'fill-parent-flow(1)';

		addButton(
			'PresetExport',
			'#Customizer_Preset_Export',
			'#Customizer_Preset_Export_Tooltip',
			() => this.exportPreset(),
			'mr-2'
		);
		addButton('PresetImport', '#Customizer_Preset_Import', '#Customizer_Preset_Import_Tooltip', () =>
			this.showImportMenu()
		);

		if (this.isAttached()) {
			const dropdownRow = $.CreatePanel('Panel', parent, '');
			dropdownRow.LoadLayoutSnippet('dynamic-dropdown');
			dropdownRow.SetDialogVariable('name', $.Localize('#Customizer_Base_EditTarget'));
			dropdownRow.AddClass('mt-3');
			const dropdown = dropdownRow.FindChildTraverse<DropDown>('DropDown')!;

			for (const [id, token] of [
				['preset', '#Customizer_Base_EditTarget_Preset'],
				['base', '#Customizer_Base_EditTarget_Base']
			]) {
				const option = $.CreatePanel('Label', dropdown, id);
				option.text = $.Localize(token);
				dropdown.AddOption(option);
			}
			dropdown.SetSelected(this.editTarget);
			dropdown.SetPanelEvent('oninputsubmit', () => {
				const target = dropdown.GetSelected()?.id;
				if (target === 'preset' || target === 'base') this.setEditTarget(target);
			});
		}
	}

	createNewPreset(newPreset: string): boolean {
		if (newPreset === 'default') {
			displayToast(
				'Reserved name!',
				'Default preset is reserved.\nyou cannot rename it or rename other presets to it!'
			);
			return;
		}
		const gamemodeID = this.gamemodeInfo.id;

		if (!this.presetList) {
			this.presetList = new Set(this.panels.customizer.listLayouts());
		}

		const presets = [...this.presetList, ...this.unsavedPresets];

		if (presets.includes(`${gamemodeID}_${newPreset}`)) {
			displayToast('Failed to create preset!', `Preset ${newPreset} already exists!`);
			return false;
		}

		this.unsavedPresets.add(`${gamemodeID}_${newPreset}`);
		this.changePreset(newPreset);
		this.updatePresetSettings();

		return true;
	}

	/**
	 * Changes the preset based on it's name. Updates the presetLayout, currentPreset and persistentStorage
	 * @param name Name of the preset
	 */
	changePreset(name: string) {
		const gamemodeID = this.gamemodeInfo.id;
		const fullPresetName = `${gamemodeID}_${name}`;

		this.editTarget = 'preset';
		this.currentPreset = name;

		if (name === 'default') {
			this.presetFile = null;
			this.updateLayers();
		} else if (this.presetList.has(fullPresetName)) {
			this.presetFile = this.loadPresetFile(name);
			this.updateLayers();
		} else if (this.baseLayout) {
			// New preset while a base exists: it starts out following the base, with no changes of its own
			this.presetFile = { base: this.baseName, components: {} };
			this.updateLayers();
		} else {
			// New preset without a base: it starts as a copy of what is shown now (presetLayout stays as it is)
			this.presetFile = null;
			HudCustomizerHandler.parentLayout = HudCustomizerHandler.defaultLayout;
		}

		$.persistentStorage.setItem(`hud-customizer.preset.${gamemodeID}`, name);
		this.reloadLayout();

		if (name === 'default') {
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
		for (const component of Object.values(previous)) {
			this.components[component.id] = component;
			this.loadComponent(component.panel, component.properties);
		}

		//Panorama needs time to layout panels
		this.setActiveComponent(this.activeComponent);
	}

	renamePreset(oldName: string, newName: string) {
		if (oldName === 'default' || newName === 'default') {
			displayToast(
				'Reserved name!',
				'Default preset is reserved.\nyou cannot rename it or rename other presets to it!'
			);
			return;
		}

		const gamemodeID = this.gamemodeInfo.id;

		const fullOldName = `${gamemodeID}_${oldName}`;
		const fullNewName = `${gamemodeID}_${newName}`;

		this.panels.customizer.renameLayout(fullOldName, fullNewName);

		this.presetList.delete(fullOldName);
		this.presetList.add(fullNewName);

		this.changePreset(newName);
		this.updatePresetSettings();
	}

	deletePreset(name: string) {
		if (name === 'default') {
			displayToast('Preset not deleted!', 'You cannot delete the default preset!');
			return;
		}

		const gamemodeID = this.gamemodeInfo.id;
		const fullPresetName = `${gamemodeID}_${name}`;

		const deleteSuccessful = this.panels.customizer.deleteLayout(fullPresetName);

		// Delete saved presets when file deletion is successful
		// Always delete unsaved presets
		const deletedSaved = deleteSuccessful ? this.presetList.delete(fullPresetName) : false;
		const deletedUnsaved = this.unsavedPresets.delete(fullPresetName);

		if (deletedSaved || deletedUnsaved) {
			this.changePreset('default');
			this.updatePresetSettings();
		} else {
			$.Warning(`Failed to delete /cfg/hud/${fullPresetName}.kv3`);
		}
	}

	/** Whether a registered component exists in the given gamemode. */
	isComponentAvailableIn(component: Component, gamemodeID: string): boolean {
		const gamemodes = component.properties.gamemode;
		if (gamemodes === undefined || gamemodes === null) return true;
		return (Array.isArray(gamemodes) ? gamemodes : [gamemodes]).some(
			(gamemode) => GamemodeInfo.get(gamemode)?.id === gamemodeID
		);
	}

	copyPreset(presetList: { gamemodeID: string; presetName: string }[]) {
		if (this.isAttached()) {
			this.setEditTarget('preset');
			this.save();
		}

		const ids = Object.keys(this.components);
		for (const { gamemodeID, presetName } of presetList) {
			this.copyComponentsToPreset(gamemodeID, presetName, ids, true);
		}
	}

	copyPanelToOtherPresets(componentID: string, presetList: { gamemodeID: string; presetName: string }[]) {
		if (this.isAttached()) {
			this.setEditTarget('preset');
			this.save();
		}

		for (const { gamemodeID, presetName } of presetList) {
			this.copyComponentsToPreset(gamemodeID, presetName, [componentID], false);
		}
	}

	/**
	 * Copies components of the current preset into another preset, leaving the target's other entries and its `base`
	 * and `meta` keys alone. Only components that exist in the target's gamemode are copied.
	 *
	 * - Target follows the base: it gets the source's own changes when the source follows the base too (so the target
	 *   keeps following its own gamemode defaults and the base), otherwise the whole components. Color profiles never go
	 *   into the target, they are added to the base's.
	 * - Target doesn't follow the base: it gets the whole components, the way presets were always copied.
	 *
	 * @param wholePreset Copying the whole preset rather than one panel. A new target then takes the source's form
	 *   (follows the base or not), and a detached target only keeps the entries that differ from the default, as
	 *   before bases. A panel copied into a new preset makes a detached preset.
	 */
	copyComponentsToPreset(gamemodeID: string, presetName: string, ids: string[], wholePreset: boolean): void {
		const raw = this.panels.customizer.loadLayout(`${gamemodeID}_${presetName}`);
		const newFollowsBase = wholePreset && this.isAttached();
		const target: PresetFile = raw
			? splitPresetFile(raw)
			: { components: {}, ...(newFollowsBase && { base: this.baseName }) };
		let components: LayerObject = { ...target.components };
		const available = ids.filter((id) => this.isComponentAvailableIn(this.components[id], gamemodeID));

		if (target.base === undefined) {
			const layout = components as unknown as HudLayout;
			for (const id of available) layout[id] = this.components[id].getLayout();
			if (wholePreset) {
				components = this.getLayoutDelta(layout, HudCustomizerHandler.defaultLayout) as unknown as LayerObject;
			}
		} else {
			const entries = this.getAttachedEntriesForCopy(available);
			for (const id of available) {
				if (entries[id]) components[id] = entries[id];
				else delete components[id];
			}
		}

		if (!this.writePresetFile(presetName, { ...target, components }, gamemodeID)) return;

		$.persistentStorage.setItem(`hud-customizer.preset.${gamemodeID}`, presetName);
		this.updatePresetSettings();
	}

	/**
	 * Component entries to copy into a preset that follows the base. From an attached source these are its own
	 * changes. From a detached source they are the whole components; their color profiles are added to the base's
	 * (renamed where a name is taken) and left out of the entries.
	 */
	getAttachedEntriesForCopy(ids: string[]): Record<string, LayerObject | undefined> {
		const entries: Record<string, LayerObject | undefined> = {};
		if (this.isAttached()) {
			for (const id of ids) entries[id] = this.presetFile!.components[id] as LayerObject | undefined;
			return entries;
		}

		const current = this.getCurrentLayoutForDelta();
		const copied: HudLayout = {};
		for (const id of ids) copied[id] = cloneData(current[id]);

		this.moveColorProfilesToBase(copied);
		this.writeGlobalStylesToBase(copied);

		for (const id of ids) entries[id] = withoutGlobalStyles(id, copied[id]) as LayerObject | undefined;
		return entries;
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

		const component = Component.register(panel, properties);

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

		this.generateComponentList();
	}

	/** Serializes all components and saves the current edit target: the preset file, or the base profile. */
	save(force = false): void {
		if (this.currentPreset === 'default') return;

		if (this.editTarget === 'base' || this.isAttached()) {
			const layout = this.getCurrentLayoutForDelta();
			if (this.editTarget === 'base') this.saveBase(layout);
			else this.saveAttachedPreset(layout, force);
			return;
		}

		const currentLayout = Object.fromEntries(
			Object.entries(this.components).map(([id, component]) => [id, component.getLayout()])
		);

		// TODO: Check we don't potentially lose data if a component fails to register once, which would
		// cause previous data to get wiped.
		const saveData = this.getLayoutDelta(currentLayout, HudCustomizerHandler.defaultLayout);
		const savedPreset = this.getLayoutDelta(HudCustomizerHandler.presetLayout, HudCustomizerHandler.defaultLayout);

		//Check if remaining components are the same as current preset
		//This is done to not save unnecessarily when switching between presets
		if (compareDeepIgnoreNull(saveData, savedPreset)) return;

		const gamemodeID = this.gamemodeInfo.id;
		const fullPresetName = `${gamemodeID}_${this.currentPreset}`;
		// Serialization done in C++.
		//TODO: This is saving with null values even though they are wiped from saveData. No idea why, it doesn't affect anything negatively
		const isSaved = this.panels.customizer.saveLayout(fullPresetName, saveData);

		if (isSaved) {
			this.unsavedPresets.delete(fullPresetName);
			this.presetList.add(fullPresetName);
			this.presetFile = this.loadPresetFile(this.currentPreset);
			HudCustomizerHandler.presetLayout = this.getPresetLayout(this.currentPreset);
			ToastAPI.CreateToast('', 'Saved!', `Preset ${this.currentPreset} has been saved!`, 2, 5, '', 'blue');
		}
	}

	/** Whether the current preset follows the base profile (stores only its differences from it). */
	isAttached(): boolean {
		return this.currentPreset !== 'default' && this.presetFile?.base !== undefined;
	}

	/**
	 * Saves an attached preset: per component, only the fields that differ from the base (or from the shipped default
	 * for pinned components). Entries of components that aren't registered in this gamemode are kept as they are.
	 */
	saveAttachedPreset(currentLayout: HudLayout, force = false): void {
		const previous = this.presetFile!;
		const components: LayerObject = { ...previous.components };

		// Color profiles are global: changes go to the base, never into the preset. This runs first so the parent
		// carries the new profiles and the preset stores no difference for them
		const savedGlobalStyles = this.saveGlobalStyles(currentLayout);

		for (const [id, layout] of Object.entries(currentLayout)) {
			const pinned = isPinned(previous.components[id]);
			const parent = HudCustomizerHandler.parentLayout[id];
			const delta = componentLayerDelta(id, parent, withGlobalStyles(id, layout, parent));

			if (pinned) components[id] = { ...delta, [PINNED_KEY]: true };
			else if (delta) components[id] = delta;
			else delete components[id];
		}

		const isNew = !this.presetList.has(this.getFullPresetName());
		const componentsChanged = force || isNew || !equalData(components, previous.components);
		if (!componentsChanged && !savedGlobalStyles) return;

		if (componentsChanged && !this.writePresetFile(this.currentPreset, { ...previous, components })) return;

		this.presetFile = { ...previous, components };
		HudCustomizerHandler.presetLayout = currentLayout;
		ToastAPI.CreateToast('', 'Saved!', `Preset ${this.currentPreset} has been saved!`, 2, 5, '', 'blue');
	}

	/**
	 * Saves the base profile, stored as field deltas on the shipped default. A new base is seeded with every field that
	 * differs from the current gamemode's shipped default. An existing base only takes the fields changed since it was
	 * loaded (see updateBaseEntry), so values set from another gamemode are not lost. Entries of components that aren't
	 * registered in this gamemode are kept as they are.
	 */
	saveBase(currentLayout: HudLayout): void {
		const previous = this.baseLayout ?? {};
		const layout: LayerObject = { ...previous };
		const shown = HudCustomizerHandler.presetLayout;

		for (const [id, componentLayout] of Object.entries(currentLayout)) {
			const shippedDefault = HudCustomizerHandler.defaultLayout[id];
			const entry = this.baseLayout
				? updateBaseComponentEntry(id, previous[id], shown?.[id], componentLayout, shippedDefault)
				: componentLayerDelta(id, shippedDefault, componentLayout);
			if (entry) layout[id] = entry;
			else delete layout[id];
		}

		if (this.baseLayout && equalData(layout, previous)) return;

		if (this.writeBaseFile(layout)) {
			HudCustomizerHandler.presetLayout = currentLayout;
			ToastAPI.CreateToast(
				'',
				$.Localize('#Customizer_Base_Saved_Header'),
				$.Localize('#Customizer_Base_Saved'),
				2,
				5,
				'',
				'blue'
			);
		}
	}

	/** Writes the base profile file and keeps baseLayout up to date. */
	writeBaseFile(layout: LayerObject): boolean {
		const isSaved = this.panels.customizer.saveLayout(
			BASE_FILE_PREFIX + this.baseName,
			serializeBaseFile({ name: this.baseName, layout }) as unknown as HudLayout
		);
		if (isSaved) this.baseLayout = layout;
		return isSaved;
	}

	/**
	 * Writes changed global styles (color profiles) of an attached preset into the base profile, creating the base if
	 * there is none yet. Afterwards the parent layout carries the new values, so the preset stores no difference.
	 * Returns whether the base was written.
	 */
	saveGlobalStyles(currentLayout: HudLayout): boolean {
		if (!this.writeGlobalStylesToBase(currentLayout)) return false;

		// A new object: parentLayout can be the same object as defaultLayout
		const parentLayout = { ...HudCustomizerHandler.parentLayout };
		for (const { component: id } of GLOBAL_STYLES) {
			if (parentLayout[id] && currentLayout[id]) {
				parentLayout[id] = withGlobalStyles(id, parentLayout[id], currentLayout[id]) as ComponentLayout;
			}
		}
		HudCustomizerHandler.parentLayout = parentLayout;
		return true;
	}

	/**
	 * Writes the global styles (color profiles) found in `layout` into the base profile where they differ from the
	 * base's current ones. A value equal to the shipped default is removed from the base instead. Returns whether the
	 * base was written.
	 */
	writeGlobalStylesToBase(layout: HudLayout): boolean {
		const current = this.getBaseResolvedLayout();
		const base: LayerObject = { ...(this.baseLayout ?? {}) };
		let changed = false;

		for (const { component: id, style } of GLOBAL_STYLES) {
			const edited = layout[id]?.dynamicStyles?.[style];
			if (edited === undefined || equalData(edited, current[id]?.dynamicStyles?.[style])) continue;

			const entry = { ...((base[id] as LayerObject | undefined) ?? {}) };
			const styles = { ...((entry.dynamicStyles as LayerObject | undefined) ?? {}) };
			if (equalData(edited, HudCustomizerHandler.defaultLayout[id]?.dynamicStyles?.[style])) delete styles[style];
			else styles[style] = cloneData(edited);

			if (Object.keys(styles).length > 0) entry.dynamicStyles = styles;
			else delete entry.dynamicStyles;
			if (Object.keys(entry).length > 0) base[id] = entry;
			else delete base[id];
			changed = true;
		}

		return changed && this.writeBaseFile(base);
	}

	/** The base as it looks in this gamemode (L0 + L1 + L2), or the shipped default when there is no base. */
	getBaseResolvedLayout(): HudLayout {
		const defaults = HudCustomizerHandler.defaultLayout;
		if (!this.baseLayout) return defaults;
		return resolveLayers([defaults as unknown as LayerObject, this.baseLayout]) as unknown as HudLayout;
	}

	getFullPresetName(preset: string = this.currentPreset, gamemodeID: string = this.gamemodeInfo.id): string {
		return `${gamemodeID}_${preset}`;
	}

	/** Writes a preset file (of the current gamemode unless given) and keeps the preset lists up to date. */
	writePresetFile(preset: string, file: PresetFile, gamemodeID: string = this.gamemodeInfo.id): boolean {
		const fullPresetName = this.getFullPresetName(preset, gamemodeID);
		const data = {
			...(file.base !== undefined && { base: file.base }),
			...(file.meta && { meta: file.meta }),
			...file.components
		};

		const isSaved = this.panels.customizer.saveLayout(fullPresetName, data as unknown as HudLayout);
		if (isSaved) {
			this.unsavedPresets.delete(fullPresetName);
			this.presetList.add(fullPresetName);
		}
		return isSaved;
	}

	/** Loads and splits a preset file of the current gamemode. Null if it doesn't exist. */
	loadPresetFile(preset: string): PresetFile | null {
		if (preset === 'default') return null;
		const raw = this.panels.customizer.loadLayout(this.getFullPresetName(preset));
		return raw ? splitPresetFile(raw) : null;
	}

	/** Loads the base profile file, null if there is none. */
	loadBase(): LayerObject | null {
		const raw = this.panels.customizer.loadLayout(BASE_FILE_PREFIX + this.baseName);
		return raw ? parseBaseFile(raw, this.baseName).layout : null;
	}

	/**
	 * Recomputes parentLayout and presetLayout from the loaded files (defaultLayout, baseLayout, presetFile) and the
	 * edit target. Does not touch the components, call reloadLayout() for that.
	 */
	updateLayers(): void {
		const defaults = HudCustomizerHandler.defaultLayout;
		const file = this.presetFile;

		if (this.currentPreset === 'default' && !file) {
			HudCustomizerHandler.parentLayout = defaults;
			HudCustomizerHandler.presetLayout = { ...defaults };
			return;
		}

		if (!file || file.base === undefined) {
			// Detached preset, stored the way presets always were
			HudCustomizerHandler.parentLayout = defaults;
			HudCustomizerHandler.presetLayout = file
				? (mergeDeep(defaults, materializeLayer(file.components, defaults)) as HudLayout)
				: { ...defaults };
			return;
		}

		// Only components that exist in this gamemode, the base may hold other gamemodes' components too
		const base: LayerObject = {};
		for (const [id, entry] of Object.entries(this.baseLayout ?? {})) {
			if (defaults[id]) base[id] = entry;
		}
		const withBase = resolveLayers([defaults as unknown as LayerObject, base]) as unknown as HudLayout;

		if (this.editTarget === 'base') {
			// Shows the base as it looks in this gamemode, without the preset's own changes
			HudCustomizerHandler.parentLayout = defaults;
			HudCustomizerHandler.presetLayout = withBase;
			return;
		}

		const parent: HudLayout = {};
		const resolved: HudLayout = {};
		for (const id of Object.keys(defaults)) {
			const entry = file.components[id] as LayerObject | undefined;
			// Global styles (color profiles) always come from the base, even for pinned components, and a preset never
			// stores its own
			parent[id] = (
				isPinned(entry) ? withGlobalStyles(id, defaults[id], withBase[id]) : withBase[id]
			) as ComponentLayout;
			resolved[id] = resolveEntry(
				id,
				parent[id],
				entry && withoutGlobalStyles(id, withoutPinned(entry))
			) as unknown as ComponentLayout;
		}

		HudCustomizerHandler.parentLayout = parent;
		HudCustomizerHandler.presetLayout = resolved;
	}

	/** Current component layouts, without `enabled` on components that can't be disabled (see save()). */
	getCurrentLayoutForDelta(): HudLayout {
		const layout: HudLayout = {};
		for (const [id, component] of Object.entries(this.components)) {
			layout[id] = component.getLayout();
			if (component.properties.canDisable === false) delete (layout[id] as Partial<ComponentLayout>).enabled;
		}
		return layout;
	}

	/**
	 * Makes the current (detached) preset follow the base. Without a base yet, the preset becomes the base. Nothing
	 * visible changes.
	 */
	attachToBase(): void {
		if (this.currentPreset === 'default' || this.isAttached()) return;

		const current = this.getCurrentLayoutForDelta();
		const toastArg = $.Localize(this.baseLayout ? '#Customizer_Base_Attached' : '#Customizer_Base_Created');

		// The preset's own color profiles join the global ones (the shipped ones when there is no base yet), so a preset
		// with fewer profiles never removes any. A name taken by different ranges gets renamed
		this.moveColorProfilesToBase(current);

		if (!this.baseLayout) {
			// The first preset to use the base seeds it
			this.editTarget = 'base';
			this.saveBase(current);
			this.editTarget = 'preset';
			if (!this.baseLayout) return;
		}

		this.presetFile = { base: this.baseName, components: {} };
		this.updateLayers();
		this.saveAttachedPreset(current, true);
		this.updateLayers();
		this.reloadLayout();
		this.updatePresetSettings();

		displayInfoToast($.Localize('#Customizer_Base_Attach'), toastArg.replace('{preset}', this.currentPreset));
	}

	/**
	 * Merges the color profiles in `layout` (a detached preset's) into the global ones and rewrites the speedometers'
	 * references to renamed profiles. Modifies `layout`.
	 */
	moveColorProfilesToBase(layout: HudLayout): void {
		const styles = layout.Speedometer?.dynamicStyles;
		if (!styles) return;

		const global = this.getBaseResolvedLayout().Speedometer?.dynamicStyles?.rangeColorProfiles;
		const { profiles, speedometers } = mergeColorProfilesIntoGlobal(
			global,
			styles.rangeColorProfiles,
			styles.speedometers,
			(name: string) => (name.startsWith('#') ? $.Localize(name) : name)
		);
		styles.rangeColorProfiles = profiles;
		styles.speedometers = speedometers;
	}

	/** Stops the current preset from following the base. It is written the way presets were stored before bases. */
	detachFromBase(): void {
		if (!this.isAttached()) return;

		this.setEditTarget('preset');
		this.save();

		const current = Object.fromEntries(
			Object.entries(this.components).map(([id, component]) => [id, component.getLayout()])
		) as HudLayout;
		const components = this.getLayoutDelta(current, HudCustomizerHandler.defaultLayout) as unknown as LayerObject;

		if (!this.writePresetFile(this.currentPreset, { components })) return;

		this.presetFile = { components };
		this.updateLayers();
		this.reloadLayout();
		this.updatePresetSettings();

		displayInfoToast(
			$.Localize('#Customizer_Base_Detach'),
			$.Localize('#Customizer_Base_Detached').replace('{preset}', this.currentPreset)
		);
	}

	/** Switches between editing the current preset and editing the base profile. Saves the previous target first. */
	setEditTarget(target: 'preset' | 'base'): void {
		if (target === this.editTarget) return;
		if (target === 'base' && !this.isAttached()) return;

		this.save();
		this.editTarget = target;
		this.updateLayers();
		this.reloadLayout();
		this.panels.settings.SetHasClass('hud-customizer-settings--base-edit', target === 'base');
	}

	/**
	 * Pins a component to the current preset (base changes no longer affect it here), or unpins it. Its current look
	 * is kept either way.
	 */
	togglePin(component: Component): void {
		if (!this.isAttached() || this.editTarget !== 'preset') return;

		this.save();

		const file = this.presetFile!;
		const entry = file.components[component.id] as LayerObject | undefined;
		if (isPinned(entry)) {
			file.components[component.id] = withoutPinned(entry!);
		} else {
			file.components[component.id] = { ...entry, [PINNED_KEY]: true };
		}

		// Saving recomputes the entry against the new parent (shipped default when pinned, the base otherwise)
		const current = this.getCurrentLayoutForDelta();
		this.updateLayers();
		this.saveAttachedPreset(current, true);
		this.updateLayers();
		this.generateComponentList();
	}

	/** See CustomizerRenderApi.getItemScope. */
	getListItemScope(component: Component, spec: KeyedListSpec, key: string): 'base' | 'preset' | undefined {
		if (!this.isAttached() || this.editTarget !== 'preset' || this.isComponentPinned(component)) return undefined;

		const parentList = HudCustomizerHandler.parentLayout[component.id]?.dynamicStyles?.[spec.style];
		const lowerKey = key.toLowerCase();
		const inParent =
			Array.isArray(parentList) && parentList.some((item: unknown) => keyOf(item, spec.key) === lowerKey);
		return inParent ? 'base' : 'preset';
	}

	/**
	 * Moves a keyed list item of the current preset into the base (`toBase`), or out of the base so only this preset
	 * keeps it. The preset looks the same afterwards; other gamemodes that follow the base gain or lose the item.
	 */
	moveListItem(component: Component, spec: KeyedListSpec, key: string, toBase: boolean): void {
		const scope = this.getListItemScope(component, spec, key);
		if (!scope || (scope === 'base') === toBase) return;

		const id = component.id;
		const lowerKey = key.toLowerCase();
		const keyOfItem = (item: unknown) => keyOf(item, spec.key);
		const matches = (item: unknown) => keyOfItem(item) === lowerKey;
		const listOf = (layout: ComponentLayout | undefined): LayerObject[] => {
			const list: unknown = layout?.dynamicStyles?.[spec.style];
			return Array.isArray(list) ? list : [];
		};

		const current = this.getCurrentLayoutForDelta();
		const currentList = listOf(current[id]);
		const item = currentList.find(matches);
		if (!item) return;

		const shown = this.getBaseResolvedLayout()[id];
		const editedBase = cloneData(shown);
		const list = listOf(editedBase).filter((other) => !matches(other));

		if (toBase) {
			// Insert after the closest item before it in this preset that the base also has, so the order matches
			const before = new Set(currentList.slice(0, currentList.findIndex(matches)).map(keyOfItem));
			let index = 0;
			for (const [i, other] of list.entries()) if (before.has(keyOfItem(other))) index = i + 1;
			list.splice(index, 0, cloneData(item));
		}
		editedBase.dynamicStyles = { ...editedBase.dynamicStyles, [spec.style]: list };

		const entry = updateBaseComponentEntry(
			id,
			this.baseLayout?.[id],
			shown,
			editedBase,
			HudCustomizerHandler.defaultLayout[id]
		);
		const base: LayerObject = { ...this.baseLayout };
		if (entry) base[id] = entry;
		else delete base[id];
		if (!this.writeBaseFile(base)) return;

		// The preset keeps what it shows; its own changes are recomputed against the new base
		this.updateLayers();
		this.saveAttachedPreset(current, true);
		this.updateLayers();

		displayInfoToast(
			$.Localize(toBase ? '#Customizer_List_MoveToBase' : '#Customizer_List_MakeModeOnly'),
			$.Localize(toBase ? '#Customizer_List_MovedToBase' : '#Customizer_List_MadeModeOnly').replace(
				'{item}',
				$.Localize(key)
			)
		);
	}

	isComponentPinned(component: Component): boolean {
		return this.isAttached() && isPinned(this.presetFile?.components[component.id]);
	}

	/**
	 * Writes the current preset as a standalone file, cfg/hud/export_<mode>_<preset>.kv3, in the format presets had
	 * before bases (whole components that differ from the shipped default), so it works without the base.
	 */
	exportPreset(): void {
		this.setEditTarget('preset');
		this.save();

		const current = Object.fromEntries(
			Object.entries(this.components).map(([id, component]) => [id, component.getLayout()])
		) as HudLayout;
		const components = this.getLayoutDelta(current, HudCustomizerHandler.defaultLayout);

		// Self-contained: only the color profiles the speedometers use; importing adds them to the global ones
		const speedometerStyles = components.Speedometer?.dynamicStyles;
		if (speedometerStyles && Array.isArray(speedometerStyles.rangeColorProfiles)) {
			const used = new Set(
				(Array.isArray(speedometerStyles.speedometers) ? speedometerStyles.speedometers : []).map(
					(speedometer: { range_color_profile?: string }) => speedometer.range_color_profile
				)
			);
			components.Speedometer = {
				...components.Speedometer,
				dynamicStyles: {
					...speedometerStyles,
					rangeColorProfiles: speedometerStyles.rangeColorProfiles.filter(
						(profile: { profile_name?: string }) => used.has(profile.profile_name)
					)
				}
			};
		}

		const fileName = `${EXPORT_FILE_PREFIX}${this.getFullPresetName()}`;
		const data = { meta: { mode: this.gamemodeInfo.id }, ...components };

		const write = () => {
			if (this.panels.customizer.saveLayout(fileName, data as unknown as HudLayout)) {
				displayInfoToast(
					$.Localize('#Customizer_Preset_Export'),
					$.Localize('#Customizer_Preset_Exported').replace('{file}', fileName)
				);
			}
		};

		if (!this.panels.customizer.listLayouts().includes(fileName)) {
			write();
			return;
		}

		UiToolkitAPI.ShowGenericPopupYesNo(
			$.Localize('#Customizer_Preset_Export'),
			$.Localize('#Customizer_Preset_Export_Overwrite').replace('{file}', fileName),
			'',
			write,
			() => UiToolkitAPI.CloseAllVisiblePopups()
		);
	}

	/** Lists the exported presets of the current gamemode to import. */
	showImportMenu(): void {
		const prefix = `${EXPORT_FILE_PREFIX}${this.gamemodeInfo.id}_`;
		const gamemodeIDs = GamemodeInfoList.map((info) => info.id);
		const files = this.panels.customizer
			.listLayouts()
			.filter(
				(name) =>
					name.startsWith(EXPORT_FILE_PREFIX) &&
					gamemodeIDForFile(name.slice(EXPORT_FILE_PREFIX.length), gamemodeIDs) === this.gamemodeInfo.id
			)
			.sort((a, b) => a.localeCompare(b));

		if (files.length === 0) {
			displayToast(
				$.Localize('#Customizer_Preset_Import'),
				$.Localize('#Customizer_Preset_Import_None').replace('{gamemode}', this.gamemodeInfo.id)
			);
			return;
		}

		UiToolkitAPI.ShowSimpleContextMenu(
			'PresetImport',
			'',
			files.map((file) => ({ label: file.slice(prefix.length), jsCallback: () => this.promptImport(file) }))
		);
	}

	promptImport(file: string): void {
		const suggested = file.slice(`${EXPORT_FILE_PREFIX}${this.gamemodeInfo.id}_`.length);
		UiToolkitAPI.ShowCustomLayoutPopupParameters(
			'ImportPreset',
			'file://{resources}/layout/modals/popups/hud-customizer-layout-name.xml',
			`title=${$.Localize('#Customizer_Preset_Import_Header')}&input_label=${$.Localize('#Customizer_Preset_Import_InputLabel')}&ok_btn_label=${$.Localize('#Customizer_Preset_Import')}&prefilled_text=${suggested}&callback=${UiToolkitAPI.RegisterJSCallback(
				(name: string) => this.importPreset(file, name)
			)}`
		);
	}

	/** Copies an exported file into a new preset of the current gamemode and selects it. It follows the base if one exists. */
	importPreset(file: string, name: string): void {
		if (name === 'default' || this.presetList.has(this.getFullPresetName(name))) {
			displayToast(
				$.Localize('#Customizer_Preset_Import'),
				$.Localize('#Customizer_Preset_Exists').replace('{preset}', name)
			);
			return;
		}

		const raw = this.panels.customizer.loadLayout(file);
		if (!raw) return;

		// Exports are stored like detached presets; drop any base / meta keys
		const { components } = splitPresetFile(raw);

		this.setEditTarget('preset');
		this.save();
		if (!this.writePresetFile(name, { components })) return;

		this.changePreset(name);
		if (this.baseLayout) this.attachToBase();
		this.updatePresetSettings();

		displayInfoToast(
			$.Localize('#Customizer_Preset_Import'),
			$.Localize('#Customizer_Preset_Imported').replace('{file}', file).replace('{preset}', name)
		);
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
			Component.register(customizerSettings.panel, customizerSettings.properties);
			this.panels.activeComponentSettings.style.visibility = 'visible';
		}

		$.Schedule(0.1, () => this.updateActiveComponentOverlayPosition());
	}

	generateComponentList() {
		// Infrequent and fast enough to just remake every time this changes.
		this.panels.generalComponentList.RemoveAndDeleteChildren();
		this.panels.gamemodeComponentList.RemoveAndDeleteChildren();

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

			const gamemode = component.properties?.gamemode;
			const availableGamemodes = Array.isArray(gamemode) ? gamemode.length : gamemode ? 1 : 2;

			if (availableGamemodes > 1) {
				const getAvailableGamemodes = (gamemodes: Gamemode | Gamemode[] | undefined) =>
					gamemodes === null || gamemodes === undefined
						? GamemodeInfoList
						: (Array.isArray(gamemodes) ? gamemodes : [gamemodes]).map((mode) => GamemodeInfo.get(mode));

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
						gamemodes: getAvailableGamemodes(component.properties.gamemode),
						presetList: [...this.presetList, ...this.unsavedPresets],
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

			if (this.isAttached() && this.editTarget === 'preset') {
				const pinned = this.isComponentPinned(component);
				const pinButton = $.CreatePanel('Button', right, `${id}PinButton`, {
					class: 'hud-customizer-settings__component__button'
				});
				pinButton.SetHasClass('hud-customizer-settings__component__button--active', pinned);
				$.CreatePanel('Image', pinButton, '', {
					src: pinned ? 'file://{images}/pin.svg' : 'file://{images}/pin-off.svg'
				});
				pinButton.SetPanelEvent('onmouseover', () =>
					UiToolkitAPI.ShowTextTooltip(
						`${id}PinButton`,
						$.Localize(pinned ? '#Customizer_Base_Unpin_Tooltip' : '#Customizer_Base_Pin_Tooltip')
					)
				);
				pinButton.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
				pinButton.SetPanelEvent('onactivate', () => this.togglePin(component));
			}

			const resetButton = $.CreatePanel('Button', right, `${id}ResetButton`, {
				class: 'hud-customizer-settings__component__button'
			});
			$.CreatePanel('Image', resetButton, '', { src: 'file://{images}/backup-restore.svg' });
			resetButton.SetPanelEvent('onmouseover', () => UiToolkitAPI.ShowTextTooltip(`${id}ResetButton`, 'Reset'));
			resetButton.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
			resetButton.SetPanelEvent('onactivate', () =>
				UiToolkitAPI.ShowCustomLayoutPopupParameters(
					'ResetComponent',
					'file://{resources}/layout/modals/popups/hud-customizer-reset.xml',
					this.editTarget === 'base'
						? `resetTitle=${$.Localize('#Customizer_Base_Reset_Header')}&resetMessage=${$.Localize('#Customizer_Base_Reset_Message').replace('{panelName}', component.properties.name)}&callback=${UiToolkitAPI.RegisterJSCallback((options: ResetOptions) => this.resetComponent(component, options))}`
						: `resetTitle=Reset ${component.properties.name}&resetMessage=Are you sure you want to reset ${component.properties.name}?&callback=${UiToolkitAPI.RegisterJSCallback((options: ResetOptions) => this.resetComponent(component, options))}`
				)
			);

			const visButton = $.CreatePanel('ToggleButton', right, `${id}VisButton`, {
				class: 'checkbox hud-customizer-settings__checkbox hud-customizer-settings__component__checkbox'
			});
			visButton.checked = component.enabled;
			visButton.SetPanelEvent('onmouseover', () =>
				UiToolkitAPI.ShowTextTooltip(`${id}VisButton`, 'Toggle Visibility')
			);
			visButton.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
			visButton.SetPanelEvent('onactivate', () => (component.enabled = visButton.checked));
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
		if (this.currentPreset === 'default') return;

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
					panel.style.flowChildren = 'down';
					const body = $.CreatePanel('Panel', panel, '', { class: 'hud-customizer-settings__custom' });

					const keyedList = KEYED_LISTS.find(
						(spec) => spec.component === component.id && spec.style === styleID
					);
					const api: CustomizerRenderApi = {
						...(keyedList && {
							getItemScope: (key: string) => this.getListItemScope(component, keyedList, key),
							moveItemToBase: (key: string) => this.moveListItem(component, keyedList, key, true),
							makeItemPresetOnly: (key: string) => this.moveListItem(component, keyedList, key, false)
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

			if (dynamicStyle.properties.type !== CustomizerPropertyType.NONE) {
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

	getPresetLayout(preset: string) {
		if (preset === 'default') {
			return this.getDefaultLayout();
		}
		const gamemodeID = this.gamemodeInfo.id;
		if (!gamemodeID) {
			throw new Error(`Could not find gamemode id for gamemode: ${this.gamemodeInfo.name}`);
		}

		const defaultLayout = this.getDefaultLayout();
		const presetLayout = $.GetContextPanel<HudCustomizer>().loadLayout(`${gamemodeID}_${preset}`);

		if (!presetLayout) {
			$.persistentStorage.setItem(`hud-customizer.preset.${gamemodeID}`, 'default');
			$.Warning(`Could not load ${gamemodeID}_${preset}.kv3 from /cfg/hud`);
			return null;
		}

		// Reserved keys (base, meta) aren't components
		const components = splitPresetFile(presetLayout).components;
		return mergeDeep(defaultLayout, materializeLayer(components, defaultLayout)) as HudLayout;
	}

	getDefaultLayout() {
		const gamemodeID = this.gamemodeInfo.id;
		if (!gamemodeID) {
			throw new Error(`Could not find gamemode id for gamemode: ${this.gamemodeInfo.name}`);
		}

		const generalLayout = $.GetContextPanel<HudCustomizer>().loadLayout('hud_default');
		const gamemodeLayout = $.GetContextPanel<HudCustomizer>().loadLayout(`${gamemodeID}_default`);

		if (!generalLayout) {
			throw new Error('Could not load hud_default.kv3 from /cfg/hud');
		}
		if (!gamemodeLayout) {
			throw new Error(`Could not load ${gamemodeID}_default.kv3 from /cfg/hud`);
		}

		// Gamemode defaults may store list deltas on hud_default's lists (e.g. KZ adds the jump speedometer)
		return mergeDeep(generalLayout, materializeLayer(gamemodeLayout, generalLayout)) as HudLayout;
	}

	getLayoutDelta(layoutA: HudLayout, layoutB: HudLayout) {
		const delta: HudLayout = {};
		for (const [id, componentLayout] of Object.entries(layoutA)) {
			if (!compareDeepAsymmetric(componentLayout, layoutB[id])) {
				delta[id] = componentLayout;
			}
		}
		return delta;
	}

	initializeLayouts() {
		const gamemodeID = this.gamemodeInfo.id;
		const preset = $.persistentStorage.getItem(`hud-customizer.preset.${gamemodeID}`) as string;

		HudCustomizerHandler.defaultLayout = this.getDefaultLayout();

		this.baseLayout = this.loadBase();
		this.editTarget = 'preset';

		const presetFile = preset && preset !== 'default' ? this.loadPresetFile(preset) : null;
		if (preset && preset !== 'default' && !presetFile) {
			$.persistentStorage.setItem(`hud-customizer.preset.${gamemodeID}`, 'default');
			$.Warning(`Could not load ${gamemodeID}_${preset}.kv3 from /cfg/hud`);
		}

		this.currentPreset = presetFile ? preset : 'default';
		this.presetFile = presetFile;

		if (presetFile?.base !== undefined && presetFile.base !== this.baseName) {
			// Only one base for now. A preset that names another base follows the current one and is re-pointed on save
			$.Warning(`HudCustomizer: preset ${preset} follows base "${presetFile.base}", using "${this.baseName}"`);
			presetFile.base = this.baseName;
		}

		this.updateLayers();
	}
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
