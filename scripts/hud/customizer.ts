import {
	CustomizerComponentProperties,
	CustomizerPropertyType,
	DynamicStyleProperties,
	IHudCustomizerHandler,
	QuerySelector,
	registerHUDCustomizerComponent,
	StyleID
} from 'common/hud-customizer';
import * as LayoutUtil from 'common/layout';
import * as Enum from 'util/enum';
import { traverseChildren } from 'util/functions';
import { GamemodeInfo } from 'common/web/maps/gamemodes.map';
import { PanelHandler } from 'util/module-helpers';

// TODO: need to do a *ton* of localization when this is done, including components!

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

const MAX_X_POS = 1920;
const MAX_Y_POS = 1080;

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
	static referencedValueListeners: Record<string, Set<string>> = {};

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

		this.enabled = componentLayout.enabled ?? true;
		this._offsetY = componentLayout.offsetY; // Stupid, but needed with current setPosition stuff. Move to C++!
		this.offsetX = componentLayout.offsetX;
		this.offsetY = componentLayout.offsetY;
		this.width = componentLayout.width ?? undefined;
		this.height = componentLayout.height ?? undefined;

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
						Component.referencedValueListeners[refKey] = new Set();
					}
					Component.referencedValueListeners[refKey].add(this.id);
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
				this.applyDynamicStyle(dynamicStyle);
			}
		}
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

		// Update position in case size change affects it (e.g. right-aligned panels)
		LayoutUtil.setPosition(this.panel, this._offsetX, this._offsetY);
	}

	get height(): number | undefined {
		return this._height;
	}

	set height(height: number | undefined) {
		this._height = height;

		if (height !== undefined) {
			LayoutUtil.setHeight(this.panel, height);
		}

		LayoutUtil.setPosition(this.panel, this._offsetX, this._offsetY);
	}

	/** Gets serializable parts of the components for saving */
	getLayout(): ComponentLayout {
		const layout: ComponentLayout = {
			enabled: this.enabled,
			offsetX: this.offsetX,
			offsetY: this.offsetY,
			width: this.width,
			height: this.height
		};

		if (this.dynamicStyles) {
			layout.dynamicStyles = {};

			for (const [styleID, dynamicStyle] of Object.entries(this.dynamicStyles)) {
				if (dynamicStyle.value === null) continue;
				layout.dynamicStyles[styleID] = dynamicStyle.value;
			}
		}

		return layout;
	}

	/** Reset a component to its original state. */
	// TODO: how tf will this work with groups lol
	reset(options: ResetOptions): void {
		const defaultComponentLayout = HudCustomizerHandler.defaultLayout[this.id];
		if (!defaultComponentLayout)
			throw new Error(`HudCustomizer: Could not load default layout for HUD customizer component ${this.id}`);

		if (options.position) {
			this.offsetX = defaultComponentLayout.offsetX;
			this.offsetY = defaultComponentLayout.offsetY;
		}

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
	}

	/** Reset a single dynamic style to it's original state */
	resetSingle(styleID: StyleID): void {
		const defaultValue = HudCustomizerHandler.defaultLayout[this.id].dynamicStyles?.[styleID];
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

	private applyDynamicStyle(style: DynamicStyle): void {
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

		if (style.properties.callbackFunc && styleValue !== undefined) {
			for (const panel of targetPanels) {
				style.properties.callbackFunc(panel, styleValue);
			}
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

	static presetLayout: HudLayout;
	static defaultLayout: HudLayout;

	currentGamemode: Gamemode;
	currentGamemodeInfo: ReturnType<typeof GamemodeInfo.get>;

	currentPreset: string;

	constructor() {
		registerHUDCustomizerComponent(this.panels.settings, {
			name: 'HUD Customizer Settings',
			dragPanel: $('#CustomizerSettingsHeader')!,
			resizeY: false,
			resizeX: false,
			canDisable: false,
			dynamicStyles: {
				selectOnRightClick: {
					name: 'Select Component With Right Click',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.toggleSelectOnRightClick(value);
					}
				},
				selectedBorder: {
					name: 'Enable Selected Component Border',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.panels.dragPanel.SetHasClass('hud-customizer-dragpanel__selected-border', value);
					}
				},
				enableGrid: {
					name: 'Enable Grid',
					type: CustomizerPropertyType.CHECKBOX,
					children: [{ styleID: 'gridSize', showWhen: true }],
					callbackFunc: (_, value) => {
						this.panels.grid.SetHasClass('hud-customizer-grid--enabled', value);
						this.createGridLines(this.gridSize);
					}
				},
				gridSize: {
					name: 'Grid Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.gridSize = value;
						this.createGridLines(this.gridSize);
					},
					settingProps: { min: 4, max: 12 }
				},
				enableSnapping: {
					name: 'Enable Snapping',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => {
						this.enableSnapping = value;
					}
				},
				defaultStyles: {
					name: 'Default Styles',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'fontStyles' }, { styleID: 'colors' }]
				},
				fontStyles: {
					name: 'Font Styles',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'fontPrimary' }, { styleID: 'fontSecondary' }]
				},
				fontPrimary: {
					name: 'Primary',
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => {
						this.updateReferencedValue('fontPrimary', value);
					}
				},
				fontSecondary: {
					name: 'Secondary',
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) => {
						this.updateReferencedValue('fontSecondary', value);
					}
				},
				colors: {
					name: 'Colors',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'gainColor' },
						{ styleID: 'lossColor' },
						{ styleID: 'progressBarBackgroundGradient' },
						{ styleID: 'progressBarFillGradient' },
						{ styleID: 'progressBarBlockedGradient' }
					]
				},
				gainColor: {
					name: 'Gain',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						this.updateReferencedValue('gainColor', value);
					}
				},
				lossColor: {
					name: 'Loss',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						this.updateReferencedValue('lossColor', value);
					}
				},
				progressBarBackgroundGradient: {
					name: 'Bar Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						this.updateReferencedValue('progressBarBackgroundGradient', value);
					}
				},
				progressBarFillGradient: {
					name: 'Bar Fill Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						this.updateReferencedValue('progressBarFillGradient', value);
					}
				},
				progressBarBlockedGradient: {
					name: 'Bar Blocked Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						this.updateReferencedValue('progressBarBlockedGradient', value);
					}
				}
			}
		});

		// Registers the *internal* variant of this event -- HudCustomizer_OpenedInternal is dispatched first and lets
		// components with special handling know to prepare for editing mode.
		$.RegisterForUnhandledEvent('HudCustomizer_OpenedInternal', () => this.enableEditing());
		$.RegisterForUnhandledEvent('HudCustomizer_Closed', () => {
			this.disableEditing();
			if (this.customizerReady) this.save();
		});

		// TODO: Below todo is *probably* fine now using events like this, but be very careful everything
		// is getting registered okay.
		// TODO (Old): I *think* we're gonna need this event to cover all cases where the HUD is reloaded.
		// Looks like some stuff like HudSpecInfoHandler listening for PanelLoaded is getting
		// called later than this though...
		$.RegisterForUnhandledEvent('MapCache_MapLoad' as any, () => {
			this.panels.customizer.toggleUI(false);
			this.currentGamemode = GameModeAPI.GetCurrentGameMode();
			this.currentGamemodeInfo = GamemodeInfo.get(this.currentGamemode);
			this.initializeLayouts();
			this.updatePresetSettings();
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
	updateReferencedValue(refKey: string, newValue: any): void {
		Component.referencedValues[refKey] = newValue;

		const listeners = Component.referencedValueListeners[refKey];
		if (!listeners) return;

		listeners.forEach((componentID) => {
			const component = this.components[componentID];
			if (component) {
				component.reloadDynamicStyles();
			}
		});
	}

	/**
	 * Recreates the preset setting list
	 */
	updatePresetSettings() {
		const panel = this.panels.presetSettingList;
		panel.RemoveAndDeleteChildren();

		const gamemodeID = this.currentGamemodeInfo.id;

		if (!this.presetList) {
			this.presetList = new Set(this.panels.customizer.listLayouts());
		}

		this.panels.settings.SetDialogVariable('preset_name', `${this.currentGamemodeInfo.name} Presets`);

		const createDropdown = (parent: GenericPanel) => {
			const panel = $.CreatePanel('Panel', parent, '');
			panel.LoadLayoutSnippet('dynamic-dropdown');
			panel.SetDialogVariable('name', 'Preset');
			const dropdown = panel.FindChildTraverse<DropDown>('DropDown')!;

			// Filters presetList + this.unsavedPresets to only those that match gamemodeID_<name> pattern, then strips gamemodeID + _
			const gamemodeIdsByLength = [...GamemodeInfo.values()]
				.map((info) => info.id)
				.sort((a, b) => b.length - a.length);

			const getGamemodeForFile = (name: string) => gamemodeIdsByLength.find((id) => name.startsWith(id + '_'));

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
			createPreset.SetPanelEvent('onactivate', () => {
				UiToolkitAPI.ShowCustomLayoutPopupParameters(
					'CreateNewPreset',
					'file://{resources}/layout/modals/popups/hud-customizer-layout-name.xml',
					`title=Create New Preset&input_label=Preset Name&ok_btn_label=Create Preset&callback=${UiToolkitAPI.RegisterJSCallback(
						(name: string) => {
							this.save();
							this.createNewPreset(name);
						}
					)}`
				);
			});

			const renamePreset = panel.FindChild('PresetRename');
			renamePreset.enabled = !isDefaultPreset;
			renamePreset.SetPanelEvent('onactivate', () => {
				UiToolkitAPI.ShowCustomLayoutPopupParameters(
					'RenamePreset',
					'file://{resources}/layout/modals/popups/hud-customizer-layout-name.xml',
					`title=Rename Preset&input_label=Rename preset ${this.currentPreset}&ok_btn_label=Create Preset&callback=${UiToolkitAPI.RegisterJSCallback(
						(name: string) => this.renamePreset(this.currentPreset, name)
					)}`
				);
			});

			const deletePreset = panel.FindChild('PresetDelete');
			deletePreset.enabled = !isDefaultPreset;
			deletePreset.SetPanelEvent('onactivate', () => {
				UiToolkitAPI.ShowGenericPopupYesNo(
					'DeletePreset',
					`Do you want to delete preset "${this.currentPreset}"?`,
					'',
					() => this.deletePreset(this.currentPreset),
					() => UiToolkitAPI.CloseAllVisiblePopups()
				);
			});
		};

		const wrapper = $.CreatePanel('Panel', panel, 'ParentWrapper', {
			class: 'hud-customizer-settings__row-wrapper'
		});

		createDropdown(wrapper);
		createButtons(wrapper);
	}

	createNewPreset(newPreset: string): boolean {
		if (newPreset === 'default') {
			displayToast(
				'Reserved name!',
				'Default preset is reserved.\nyou cannot rename it or rename other presets to it!'
			);
			return;
		}
		const gamemodeID = this.currentGamemodeInfo.id;

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
		const gamemodeID = this.currentGamemodeInfo.id;
		const fullPresetName = `${gamemodeID}_${name}`;

		if (this.presetList.has(fullPresetName)) {
			HudCustomizerHandler.presetLayout = this.getPresetLayout(name);
		}

		this.currentPreset = name;
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

		const gamemodeID = this.currentGamemodeInfo.id;

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

		const gamemodeID = this.currentGamemodeInfo.id;
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
			if (!allowed.includes(this.currentGamemode)) {
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

	applyToOtherPresets(presetList: { gamemodeID: string; presetName: string }[]) {
		const componentID = this.activeComponent.id;
		const componentData: ComponentLayout = this.components[componentID].getLayout();

		for (const preset of presetList) {
			const fullPresetName = `${preset.gamemodeID}_${preset.presetName}`;
			const presetData = this.panels.customizer.loadLayout(fullPresetName);
			if (!presetData) {
				const hudLayout: HudLayout = {
					[componentID]: componentData
				};
				const saveSuccessful = this.panels.customizer.saveLayout(fullPresetName, hudLayout);

				if (saveSuccessful) {
					$.persistentStorage.setItem(`hud-customizer.preset.${preset.gamemodeID}`, preset.presetName);
					this.presetList.add(fullPresetName);
				}
			} else {
				presetData[componentID] = componentData;
				this.panels.customizer.saveLayout(fullPresetName, presetData);
			}
		}
	}

	/** Serializes all component and saves cfg/hud.json. */
	save(): void {
		if (this.currentPreset === 'default') return;

		// TODO: Check we don't potentially lose data if a component fails to register once, which would
		// cause previous data to get wiped.
		const saveData: HudLayout = {};

		//Strip out components that are exactly the same as default layout
		for (const [id, component] of Object.entries(this.components)) {
			const layout = component.getLayout();
			const defaultLayout = HudCustomizerHandler.defaultLayout[id];

			if (!isDeepEqual(layout, defaultLayout)) {
				saveData[id] = layout;
			}
		}
		//It's possible there will be nothing to save, don't write files if that's the case
		if (Object.keys(saveData).length === 0) {
			return;
		}

		//Check if remaining components are the same as current preset
		//This is done to not save unnecessarily when switching between presets
		const isSaveDataSameAsCurrentPreset = () => {
			for (const [id, componentLayout] of Object.entries(saveData)) {
				const presetLayout = HudCustomizerHandler.presetLayout[id];
				if (!isDeepEqual(componentLayout, presetLayout)) return false;
			}
			return true;
		};

		const gamemodeID = this.currentGamemodeInfo.id;

		if (!isSaveDataSameAsCurrentPreset()) {
			const fullPresetName = `${gamemodeID}_${this.currentPreset}`;
			// Serialization done in C++.
			this.panels.customizer.saveLayout(fullPresetName, saveData);

			if (this.unsavedPresets.has(fullPresetName)) {
				this.unsavedPresets.delete(fullPresetName);
				this.presetList.add(fullPresetName);
			}
		}
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
	}

	disableEditing(): void {
		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.dragPanel, this.dragStartHandle);
		}

		this.panels.overlay.style.visibility = 'collapse';
		this.toggleSelectOnRightClick(false);
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
					`resetTitle=Reset ${component.properties.name}&resetMessage=Are you sure you want to reset ${component.properties.name}?&callback=${UiToolkitAPI.RegisterJSCallback((options: ResetOptions) => this.resetComponent(component, options))}`
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

		this.panels.overlay.SetDialogVariable('name', this.activeComponent.panel.id);
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

					break;
				}

				case CustomizerPropertyType.FONT_PICKER: {
					panel.LoadLayoutSnippet('dynamic-fontpicker');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);
					const dropdown = panel.FindChildTraverse<DropDown>('DropDown')!;

					for (const font of this.fonts) {
						const panel = $.CreatePanel('Label', dropdown, font);
						panel.text = font;
						// Disabled because it causes extreme lag on linux ( can't test windows )
						// panel.style.fontFamily = font;
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
				}
			}

			if (dynamicStyle.properties.type !== CustomizerPropertyType.NONE) {
				panel.SetPanelEvent('oncontextmenu', () => {
					UiToolkitAPI.ShowSimpleContextMenu('', '', [
						{
							label: 'Reset Style',
							jsCallback: () => {
								component.resetSingle(styleID);
								this.updateActiveComponentSettings();
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

		// Append "Save To Other Gamemodes" button only if there are 2 or more gamemodes available.
		// Panels without gamemodes specified are available in all gamemodes, therefore they have the button always appended
		const gamemode = component.properties?.gamemode;
		const availableGamemodes = Array.isArray(gamemode) ? gamemode.length : gamemode ? 1 : 2;

		if (availableGamemodes > 1) {
			const applyToOtherPresets = $.CreatePanel(
				'Panel',
				this.panels.activeComponentSettingsList,
				'ApplyToOtherPresets',
				{
					class: 'hud-customizer-settings__row-wrapper h-fit-children'
				}
			);

			const getAvailableGamemodes = (gamemodes: Gamemode | Gamemode[]) => {
				if (gamemodes === undefined || gamemodes === null) {
					return [...GamemodeInfo.values()].map((info) => info.id).join(',');
				} else {
					const normalizedGamemodes = Array.isArray(gamemodes) ? gamemodes : [gamemodes];
					return normalizedGamemodes.map((mode) => GamemodeInfo.get(mode).id).join(',');
				}
			};

			const getPresetList = () => {
				return [...this.presetList, ...this.unsavedPresets].join(',');
			};

			applyToOtherPresets.SetPanelEvent('onactivate', () =>
				UiToolkitAPI.ShowCustomLayoutPopupParameters(
					'ApplyToOtherPresets',
					'file://{resources}/layout/modals/popups/hud-customizer-apply-to-other-presets.xml',
					`gamemodes=${getAvailableGamemodes(component.properties.gamemode)}&presetList=${getPresetList()}&callback=${UiToolkitAPI.RegisterJSCallback(
						(presetList: { gamemodeID: string; presetName: string }[]) =>
							this.applyToOtherPresets(presetList)
					)}`
				)
			);

			applyToOtherPresets.LoadLayoutSnippet('apply-to-other');
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
		if (enabled) {
			for (const component of Object.values(this.components)) {
				if (component.dragPanel) {
					component.dragPanel.SetPanelEvent('oncontextmenu', () => this.setActiveComponent(component));
				} else {
					component.panel.SetPanelEvent('oncontextmenu', () => this.setActiveComponent(component));
				}
			}
		} else {
			for (const component of Object.values(this.components)) {
				if (component.dragPanel) {
					component.dragPanel.ClearPanelEvent('oncontextmenu');
				} else {
					component.panel.ClearPanelEvent('oncontextmenu');
				}
			}
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
				this.activeGridlines[axis] = gridline;
			}
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

			// TODO: unset gridline if nothing found
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

		const numXLines = 2 ** gridSize;
		const numYLines = Math.floor(numXLines * (9 / 16));

		this.gridlines = [[], []];
		this.activeGridlines = [undefined, undefined];

		for (const axis of Axes) {
			const isX = axis === 0;
			const numLines = isX ? numXLines : numYLines;
			const totalLength = isX ? MAX_X_POS : MAX_Y_POS;

			this.gridlines[axis] = Array.from({ length: numLines + 1 }, (_, i) => {
				const offset = totalLength * (i / numLines);

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
		return (axis === Axis.X ? MAX_X_POS : MAX_Y_POS) / this.gridlines[axis].length;
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
						`hud-customizer-overlay__resize-knobs__knob${DragMode[dir].toLowerCase().replace('resize_', '--').replace('_', '-')}`,
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
		const gamemodeID = this.currentGamemodeInfo.id;
		if (!gamemodeID) {
			throw new Error(`Could not find gamemode id for gamemode:${this.currentGamemode}`);
		}

		const defaultLayout = this.getDefaultLayout();
		const presetLayout = $.GetContextPanel<HudCustomizer>().loadLayout(`${gamemodeID}_${preset}`);

		if (!presetLayout) {
			$.persistentStorage.setItem(`hud-customizer.preset.${gamemodeID}`, 'default');
			this.currentPreset = 'default';
			$.Warning(`Could not load ${gamemodeID}_${preset}.kv3 from /cfg/hud`);
		}

		return deepMerge(defaultLayout, presetLayout);
	}

	getDefaultLayout() {
		const gamemodeID = this.currentGamemodeInfo.id;
		if (!gamemodeID) {
			throw new Error(`Could not find gamemode id for gamemode:${this.currentGamemode}`);
		}

		const generalLayout = $.GetContextPanel<HudCustomizer>().loadLayout('hud_default');
		const gamemodeLayout = $.GetContextPanel<HudCustomizer>().loadLayout(`${gamemodeID}_default`);

		if (!generalLayout) {
			throw new Error('Could not load hud_default.kv3 from /cfg/hud');
		}
		if (!gamemodeLayout) {
			throw new Error(`Could not load ${gamemodeID}_default.kv3 from /cfg/hud`);
		}

		return { ...generalLayout, ...gamemodeLayout };
	}

	initializeLayouts() {
		const gamemodeID = this.currentGamemodeInfo.id;
		const preset = $.persistentStorage.getItem(`hud-customizer.preset.${gamemodeID}`) as string;

		HudCustomizerHandler.defaultLayout = this.getDefaultLayout();

		if (preset) {
			this.currentPreset = preset;
			HudCustomizerHandler.presetLayout = this.getPresetLayout(preset);
		} else {
			this.currentPreset = 'default';
			HudCustomizerHandler.presetLayout = { ...HudCustomizerHandler.defaultLayout };
		}
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

/**
 * Compares two layouts of components.
 * If B has properties that are missing from A, components are still treated as equal
 * @param a Component Layout Object
 * @param b Component Layout Object
 * @returns boolean
 */
function isDeepEqual(a: any, b: any): boolean {
	if (a === b) return true;

	if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
		return false;
	}

	if (Array.isArray(a)) {
		if (!Array.isArray(b) || a.length !== b.length) return false;
		return a.every((val, index) => isDeepEqual(val, b[index]));
	}

	const keysA = Object.keys(a);

	for (const key of keysA) {
		// Combined the check for key existence and the recursive equality check
		if (Object.hasOwn(b, key) && !isDeepEqual(a[key], b[key])) {
			return false;
		}
	}

	return true;
}

/**
 * Deeply merges multiple objects into a new object.
 * Arrays and primitives are overwritten; nested objects are merged recursively.
 */
function deepMerge<T extends Record<string, any>>(...objects: Partial<T>[]): T {
	const isObject = (item: unknown) => Boolean(item && typeof item === 'object' && !Array.isArray(item));

	return objects.reduce((acc, obj) => {
		if (!isObject(obj)) return acc;

		Object.keys(obj).forEach((key) => {
			const accValue = acc[key];
			const objValue = obj[key];

			if (isObject(accValue) && isObject(objValue)) {
				acc[key] = deepMerge(accValue, objValue);
			} else {
				// Arrays and primitives are assigned directly
				acc[key] = objValue;
			}
		});

		return acc;
	}, {} as any) as T;
}

function displayToast(title: string, message: string) {
	ToastAPI.CreateToast('', title, message, 2, 10, '', 'red');
}
