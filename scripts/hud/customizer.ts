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

export interface HudLayout {
	components: Record<string, ComponentLayout>;
	settings: {
		enableGrid: boolean;
		gridSize: number;
		enableSnapping: boolean;
	};
}

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

const DEFAULT_GRID_SIZE = 5;
const DEFAULT_GRID_ENABLED = true;
const DEFAULT_SNAP_ENABLED = true;
const MAX_X_POS = 1920;
const MAX_Y_POS = 1080;

// Fraction of grid spacing to snap within
const SNAPPING_THRESHOLD = 0.1;

// Fraction of grid spacing to snap within for the center line
const CENTER_SNAPPING_THRESHOLD = 0.15;

// Margin around the overlay panel. Needed so that resize handles etc. don't get cut off.
const OVERLAY_MARGIN = 32;

// TODO: This behaviour is super annoying, almost certainly want to remove
const SELECT_COMPONENT_ON_HOVER = false;

interface DynamicStyle {
	properties: Readonly<DynamicStyleProperties>;
	value: any;
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

	private static userLayout: HudLayout | undefined;
	private static defaultLayout: HudLayout;

	static {
		Component.userLayout = $.GetContextPanel<HudCustomizer>().getLayout();
		Component.defaultLayout = $.GetContextPanel<HudCustomizer>().getDefaultLayout();

		if (!Component.defaultLayout) {
			throw new Error('HudCustomizer: Could not load default layout for HUD customizer!');
		}
	}

	/** @see registerHUDCustomizerComponent */
	static register(panel: GenericPanel, properties: CustomizerComponentProperties): Component {
		return new Component(panel, properties);
	}

	private constructor(panel: GenericPanel, properties: CustomizerComponentProperties) {
		this.panel = panel;
		this.dragPanel = properties.dragPanel;
		this.properties = properties;
		this.id = panel.id;

		// If we add new components after release, use layout from default for any missing components
		const userComponentLayout = Component.userLayout?.components?.[this.id];
		const defaultComponentLayout = Component.defaultLayout.components?.[this.id];
		const componentLayout = userComponentLayout ?? defaultComponentLayout;

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
				const value =
					componentLayout.dynamicStyles?.[styleID as StyleID] ??
					defaultComponentLayout?.dynamicStyles?.[styleID as StyleID];
				if (value === undefined) {
					throw new Error(
						`HudCustomizer: Could not load dynamic style value for ${styleID} in component ${this.id}`
					);
				}

				const dynamicStyle = {
					properties: styleProps as DynamicStyleProperties,
					value
				};

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
				layout.dynamicStyles[styleID] = dynamicStyle.value;
			}
		}

		return layout;
	}

	/** Reset a component to its original state. */
	// TODO: how tf will this work with groups lol
	reset(): void {
		const defaultComponentLayout = Component.defaultLayout.components?.[this.id];
		if (!defaultComponentLayout)
			throw new Error(`HudCustomizer: Could not load default layout for HUD customizer component ${this.id}`);

		this.enabled = defaultComponentLayout.enabled ?? true;
		this.offsetX = defaultComponentLayout.offsetX;
		this.offsetY = defaultComponentLayout.offsetY;
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

		if (style.properties.styleProperty) {
			// We have extremely strong types in the common/hud-customizer.ts stuff to constrain dynamicStyles to
			// valid combinations. Proving to the TS that everything is valid here is a pain though, not worth it.
			const styleValue = style.properties.valueFn?.(style.value as any) ?? style.value;

			if (styleValue !== undefined) {
				for (const panel of targetPanels) {
					(panel as any).style[style.properties.styleProperty] = styleValue;
					// @ts-expect-error wadsasdasd
					panel.MarkStylesDirty(true);
				}
			}
		}

		if (style.properties.callbackFunc) {
			for (const panel of targetPanels) {
				style.properties.callbackFunc(panel, style.value as any);
			}
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
		componentList: $<Panel>('#ComponentList')!,
		activeComponentSettings: $<Panel>('#ActiveComponentSettings')!,
		activeComponentSettingsList: $<Panel>('#ActiveComponentSettingsList')!,
		resizeKnobs: $<Panel>('#ResizeKnobs')!,
		grid: $.GetContextPanel().GetParent()!.FindChildTraverse('HudCustomizerGrid')!,
		gridToggle: $<ToggleButton>('#GridToggle')!,
		gridSize: $<NumberEntry>('#GridSize')!,
		snappingToggle: $<ToggleButton>('#SnappingToggle')!
	};

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
	enableGrid: boolean = undefined!;
	enableSnapping: boolean = undefined!;

	layout?: HudLayout;
	defaultLayout?: HudLayout;

	constructor() {
		registerHUDCustomizerComponent(this.panels.settings, {
			dragPanel: $('#CustomizerSettingsHeader')!,
			resizeY: false,
			resizeX: false,
			// marginSettings: false,
			// paddingSettings: false,
			// backgroundSettings: false
		});

		$.RegisterForUnhandledEvent('HudCustomizer_EnabledInternal', () => this.enableEditing());
		$.RegisterForUnhandledEvent('HudCustomizer_Disabled', () => this.disableEditing());

		// TODO: Below todo is *probably* fine now using events like this, but be very careful everything
		// is getting registered okay.
		// TODO (Old): I *think* we're gonna need this event to cover all cases where the HUD is reloaded.
		// Looks like some stuff like HudSpecInfoHandler listening for PanelLoaded is getting
		// called later than this though...
		$.RegisterForUnhandledEvent('HudInit' as any, () => {
			// Once HUD is fully initialized, let components awaiting registration know to load component
			$.DispatchEvent('HudCustomizer_Ready');
		});

		// TODO: This was just for case of someone changin layout via file and wanting to update ingame.
		// Not  sure if we should even support, and dont wanna think about rn.
		// $.RegisterEventHandler('HudCustomizer_LayoutReloaded', this.panels.customizer, () => {
		// 	this.load();
		// });

		this.gridlines = [[], []];
		this.activeGridlines = [undefined, undefined];
		this.activeComponent = undefined;

		this.layout = this.panels.customizer.getLayout();

		this.gridSize = this.layout?.settings?.gridSize ?? DEFAULT_GRID_SIZE;
		this.panels.gridSize.value = this.gridSize;

		this.enableGrid = this.layout?.settings?.enableGrid ?? DEFAULT_GRID_ENABLED;
		this.panels.gridToggle.checked = this.enableGrid;

		this.enableSnapping = this.layout?.settings?.enableSnapping ?? DEFAULT_SNAP_ENABLED;
		this.panels.snappingToggle.checked = this.enableSnapping;

		this.panels.activeComponentSettings.visible = false;

		this.fonts = UiToolkitAPI.GetSortedValidFontNames().toSorted((a, b) => a.localeCompare(b));

		UiToolkitAPI.GetGlobalObject()['HudCustomizerHandler'] = this;
	}

	/**
	 * Registers a HUD component with the customizer. This *must* be called after `HudCustomizer_Ready` fires, use with
	 * `registerHUDCustomizerComponent`!
	 * @see registerHUDCustomizerComponent
	 */
	loadComponent(panel: GenericPanel, properties: CustomizerComponentProperties): void {
		if (!panel) return;

		const component = Component.register(panel, properties);
		this.components[component.id] = component;

		this.generateComponentList();
	}

	/** Serializes all component and saves cfg/hud.json. */
	save(): void {
		// TODO: Check we don't potentially lose data if a component fails to register once, which would
		// cause previous data to get wiped.
		const saveData: HudLayout = {
			settings: {
				gridSize: this.gridSize,
				enableGrid: this.enableGrid,
				enableSnapping: this.enableSnapping
			},
			components: {}
		};

		for (const [id, component] of Object.entries(this.components)) {
			saveData.components[id] = component.getLayout();
		}

		// Serialization and filesystem stuff done in C++.
		this.panels.customizer.saveLayout(saveData);
	}

	enableEditing(): void {
		if (!this.components || Object.keys(this.components).length === 0) {
			throw new Error("HudCustomizer: Tried to enable editing, but we weren't loaded!");
		}

		if (SELECT_COMPONENT_ON_HOVER) {
			for (const component of Object.values(this.components)) {
				if (component.dragPanel) {
					component.dragPanel.SetPanelEvent('onmouseover', () => this.setActiveComponent(component));
				} else {
					component.panel.SetPanelEvent('onmouseover', () => this.setActiveComponent(component));
				}
			}
		}

		this.createGridLines();
		this.updateGridVisibility();
		this.createResizeKnobs();

		this.activeComponent ??= this.components[Object.keys(this.components)[0]];

		// // Some components like Comparisons need to populate themselves with dummy data when editing gets enabled.
		// // If they're going to be the first component selected, we need to wait until they finish initing before
		// // setting them active.
		// if (this.activeComponent.properties.asyncInit) {
		// 	const handle = $.RegisterForUnhandledEvent('HudCustomizer_ComponentInitialized', () => {
		// 		this.setActiveComponent(this.activeComponent!);
		// 		$.UnregisterForUnhandledEvent('HudCustomizer_ComponentInitialized', handle);
		// 	});
		// } else {
			this.setActiveComponent(this.activeComponent);
		// }
	}

	disableEditing(): void {
		for (const component of Object.values(this.components)) {
			if (component.dragPanel) {
				component.dragPanel.ClearPanelEvent('onmouseover');
			} else {
				component.panel.ClearPanelEvent('onmouseover');
			}
		}

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.dragPanel, this.dragStartHandle);
		}

		// Customizer closing, write to disk
		this.save();
	}

	/**
	 * Toggles HUD customizer mode, taking control of user input.
	 *
	 * This is one of the few places where C++ does all the heavy lifting. Based on `enable`, it toggles the following:
	 * - Game input -- currently *handled* mouse events, and key inputs,
	 * - The `hud--customizer-enabled` class on the `<Hud />` panel,
	 * - `hittestchildren` on `<HudCustomizer />`,
	 * - Dispatches `HudCustomizer_Enabled` or `HudCustomizer_Disabled`.
	 */
	toggle(enable: boolean) {
		this.panels.customizer.toggleUI(enable);
	}

	generateComponentList() {
		// Infrequent and fast enough to just remake every time this changes.
		this.panels.componentList.RemoveAndDeleteChildren();

		for (const [id, component] of Object.entries(this.components)) {
			const panel = $.CreatePanel('RadioButton', this.panels.componentList, `${id}Settings`);
			panel.LoadLayoutSnippet('component');
			panel.SetDialogVariable('name', id);
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
				UiToolkitAPI.ShowGenericPopupOkCancel(
					'Reset Component',
					`Are you sure you want to reset ${id}?`,
					'Reset',
					() => this.resetComponent(component),
					() => {}
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
		}
	}

	setActiveComponent(component: Component): void {
		const componentRadioButton = this.panels.componentList.FindChildTraverse<RadioButton>(
			`${component.id}Settings`
		);

		if (!componentRadioButton) {
			throw new Error(`HudCustomizer: Could not find component radio button for ${component.id}`);
		}

		// Handler already set up to for this activation to call setActiveComponentInternal
		$.DispatchEvent('Activated', componentRadioButton, PanelEventSource.MOUSE);
	}

	setActiveComponentInternal(component: Component): void {
		this.activeComponent = component;

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

		this.panels.overlay.SetDialogVariable('name', this.activeComponent.panel.id);
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
		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.dragPanel, (...args) => {
			this.onStartDrag(DragMode.MOVE, this.panels.dragPanel, ...args);
		});
		if (this.dragEndHandle) {
			$.UnregisterEventHandler('DragEnd', this.panels.dragPanel, this.dragEndHandle);
		}
		this.dragEndHandle = $.RegisterEventHandler('DragEnd', this.panels.dragPanel, () => {
			this.onEndDrag();
		});
	}

	updateActiveComponentSettings(): void {
		this.panels.activeComponentSettingsList.RemoveAndDeleteChildren();

		const component = this.activeComponent;

		if (!component || !component.dynamicStyles || Object.keys(component.dynamicStyles).length === 0) {
			this.panels.activeComponentSettings.visible = false;
			return;
		}

		this.panels.activeComponentSettings.visible = true;
		this.panels.settings.SetDialogVariable('active_name', component.id);

		// Generate settings based on CustomizerPropertyType
		for (const [styleID, dynamicStyle] of Object.entries(component.dynamicStyles)) {
			const panel = $.CreatePanel('Panel', this.panels.activeComponentSettingsList, '');

			switch (dynamicStyle.properties.type) {
				case CustomizerPropertyType.NUMBER_ENTRY: {
					panel.LoadLayoutSnippet('dynamic-numberentry');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);
					const numberEntry = panel.FindChildTraverse<NumberEntry>('NumberEntry')!;

					if (dynamicStyle.properties.settingProps) {
						Object.assign(numberEntry, dynamicStyle.properties.settingProps);
					}

					numberEntry.value = (component.dynamicStyles[styleID]?.value as number) ?? 0;
					numberEntry.SetPanelEvent('onvaluechanged', () =>
						component.setDynamicStyle(styleID, numberEntry.value)
					);

					break;
				}

				case CustomizerPropertyType.CHECKBOX: {
					panel.LoadLayoutSnippet('dynamic-checkbox');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);
					const checkbox = panel.FindChildTraverse<ToggleButton>('Checkbox')!;

					if (dynamicStyle.properties.settingProps) {
						Object.assign(checkbox, dynamicStyle.properties.settingProps);
					}

					checkbox.checked = (component.dynamicStyles[styleID]?.value as boolean) ?? false;

					checkbox.SetPanelEvent('onactivate', () => component.setDynamicStyle(styleID, checkbox.checked));

					break;
				}

				case CustomizerPropertyType.COLOR_PICKER: {
					panel.LoadLayoutSnippet('dynamic-colorpicker');

					const colorDisplay = panel.FindChildTraverse<ColorDisplay>('ColorDisplay')!;
					colorDisplay.text = dynamicStyle.properties.name;
					colorDisplay.SetPanelEvent('oncolorchange', () =>
						component.setDynamicStyle(styleID, colorDisplay.color)
					);

					// We use hex for display here since it's more compact, but internally is rgba
					// since that's what PanoramaTypeToV8Param<Color> uses, don't want to change that.
					colorDisplay.color =
						(component.dynamicStyles[styleID]?.value as rgbaColor) ?? 'rgba(255, 255, 255, 1)';

					break;
				}

				// TODO: More generic DROPDOWN version that takes array of entries
				case CustomizerPropertyType.FONT_PICKER: {
					panel.LoadLayoutSnippet('dynamic-fontpicker');
					panel.SetDialogVariable('name', dynamicStyle.properties.name);
					const dropdown = panel.FindChildTraverse<DropDown>('DropDown')!;

					for (const font of this.fonts) {
						const panel = $.CreatePanel('Label', dropdown, font);
						panel.text = font;
						panel.style.fontFamily = font;
						dropdown.AddOption(panel);
					}

					let value: string;
					dropdown.SetPanelEvent('oninputsubmit', () => {
						value = dropdown.GetSelected().id;
						component.setDynamicStyle(styleID, value);
					});
					dropdown.SetSelected(component.dynamicStyles[styleID]?.value as string);
				}
			}
		}
	}

	resetComponent(component: Component): void {
		component.reset();

		// Calling this ensures overlay panel and stuff get updated if you have the component selected already.
		// If you don't, you probably want it to be!
		this.setActiveComponent(component);
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
		if (this.activeComponent.width !== undefined) {
			LayoutUtil.setWidth(this.panels.dragPanel, this.activeComponent.width);
		}
		if (this.activeComponent.height !== undefined) {
			LayoutUtil.setHeight(this.panels.dragPanel, this.activeComponent.height);
		}

		this.panels.overlay.RemoveClass('hud-customizer-overlay--dragging');

		this.activeGridlines?.forEach((line) => line?.panel.RemoveClass('hud-customizer-grid__line--highlight'));
		this.activeGridlines = [undefined, undefined];

		this.dragMode = undefined;
	}

	handleMoveSnapping(): void {
		if (!this.activeComponent) return;

		const shouldSnap = this.panels.snappingToggle.checked;

		for (const axis of Axes) {
			const gridGapLength = this.getGridGapLength(axis);
			const panelPos = LayoutUtil.getPosition(this.panels.dragPanel)[axis];
			const panelSize = LayoutUtil.getSize(this.panels.dragPanel)[axis];
			const panelRightPos = panelPos + panelSize;

			// Centering takes precendence, if we can center within thresold of SNAPPING_THRESHOLD, do that
			const centerPos = panelPos + panelSize / 2;
			const centerGridline = this.gridlines[axis][Math.floor(this.gridlines[axis].length / 2)];
			const centerDist = Math.abs(centerGridline.offset - centerPos);
			if (centerDist <= CENTER_SNAPPING_THRESHOLD * gridGapLength) {
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

		const shouldSnap = this.panels.snappingToggle.checked;

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

	createGridLines(): void {
		this.panels.grid.RemoveAndDeleteChildren();

		const numXLines = 2 ** this.gridSize;
		const numYLines = Math.floor(numXLines * (9 / 16));

		this.gridlines = [[], []];
		this.activeGridlines = [undefined, undefined];

		for (const axis of Axes) {
			const isX = axis === 0;
			const numLines = isX ? numXLines : numYLines;
			const totalLength = isX ? MAX_X_POS : MAX_Y_POS;

			this.gridlines[axis] = Array.from({ length: numLines }, (_, i) => {
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

	updateGridVisibility(): void {
		const enabled = this.panels.gridToggle.checked;
		this.panels.grid.SetHasClass('hud-customizer-grid--enabled', enabled);
		this.panels.gridSize.enabled = enabled;
		this.panels.snappingToggle.enabled = enabled;
	}

	updateGridSize(): void {
		const newSize = this.panels.gridSize.value;

		if (newSize !== this.gridSize) {
			this.gridSize = newSize;
			this.createGridLines();
		}
	}

	getGridGapLength(axis: Axis): number {
		return (axis === Axis.X ? MAX_X_POS : MAX_Y_POS) / this.gridlines[axis].length;
	}

	createResizeKnobs(): void {
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
}

function parsePx(str: string): number | undefined {
	if (str?.slice(-2) === 'px') {
		return Number.parseFloat(str.slice(0, -2));
	}
	return undefined;
}

function getMinSize(panel: GenericPanel): [number, number] {
	return [parsePx(panel.style.minWidth) ?? 0, parsePx(panel.style.minHeight) ?? 0];
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
