import {
	CustomizerComponentProperties,
	CustomizerPropertyType,
	DynamicStyleProperties,
	IHudCustomizerHandler,
	QuerySelector,
	StyleID
} from 'common/hud-customizer';
import * as LayoutUtil from 'common/layout';
import * as Enum from 'util/enum';
import { traverseChildren } from 'util/functions';
import { PanelHandler } from 'util/module-helpers';

/* eslint-disable unicorn/explicit-length-check */ // - wrongly detecting .size props

// TODO: need to do a *ton* of localization when this is done, including components!

/** Structure of layout stored out to JSON */
interface ComponentLayout {
	enabled: boolean;
	// Pairs of numbers.
	// Keep in mind these are arrays, so have *reference* semantics. Use $.StructuredClone where needed!
	position: LayoutUtil.Position;
	/** If not provided, panel gets fit-children */
	size?: LayoutUtil.Size;
	dynamicStyles?: Record<StyleID, unknown>;
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
const MAX_OOB = 16;
// Fraction of grid spacing to snap within
const SNAPPING_THRESHOLD = 0.1;
// Fraction of grid spacing to snap within for the center line
const CENTER_SNAPPING_THRESHOLD = 0.15;
// Stupid hack to align header (thing containing component name and stuff). Must correspond to $header-height in Sass.
const OVERLAY_HEADER_HEIGHT = 21;

// interface Component {
// 	panel: GenericPanel;
// 	dynamicStyles?: Record<StyleID, DynamicStyle & { value: unknown }>;
// 	// Temp values for position and size that makes a lot of code simpler.
// 	// These do *not* update the actual panel until you use LayoutUtil to set them.
// 	position: LayoutUtil.Position;
// 	size?: LayoutUtil.Size;
// 	enabled: boolean;
// 	settings: Omit<CustomizerComponentProperties, 'dynamicStyles'>;
// }

interface DynamicStyle {
	properties: Readonly<DynamicStyleProperties>;
	value: any;
}

/**
 * Represents a customizable HUD component, able to be loaded from and serialized to layout files.
 *
 * These classes are responsible for their inner panels's actual layout; updating size, position, enabled etc...
 * update the values saved out to layout, AND update the actual panel's properties.
 */
class Component {
	readonly id: string;
	readonly panel: GenericPanel;
	readonly properties: Readonly<CustomizerComponentProperties>;
	readonly dynamicStyles?: Record<StyleID, DynamicStyle>;

	private _enabled: boolean = undefined!;
	private _position: LayoutUtil.Position = undefined!;
	private _size?: LayoutUtil.Size;

	private static userLayout: HudLayout | undefined;
	private static defaultLayout: HudLayout;

	static {
		Component.userLayout = $.GetContextPanel<HudCustomizer>().getLayout();
		Component.defaultLayout = $.GetContextPanel<HudCustomizer>().getDefaultLayout();

		if (!Component.defaultLayout) {
			throw new Error('HudCustomizer: Could not load default layout for HUD customizer!');
		}
	}

	static register(panel: GenericPanel, properties: CustomizerComponentProperties): Component {
		return new Component(panel, properties);
	}

	private constructor(panel: GenericPanel, properties: CustomizerComponentProperties) {
		this.panel = panel;
		this.properties = properties;
		this.id = panel.id;

		const userComponentLayout = Component.userLayout?.components?.[this.id];
		const defaultComponentLayout = Component.defaultLayout.components?.[this.id];
		const componentLayout = userComponentLayout ?? defaultComponentLayout;

		if (!componentLayout)
			throw new Error(`HudCustomizer: Could not load layout for HUD customizer component ${this.id}`);

		this.position = componentLayout.position;
		this.size = componentLayout.size ?? undefined;
		this.enabled = componentLayout.enabled ?? true;

		if (properties.dynamicStyles) {
			this.dynamicStyles = {};

			for (const [styleID, styleProps] of Object.entries(properties.dynamicStyles)) {
				const dynamicStyle = {
					properties: styleProps as DynamicStyleProperties,
					// Just in case we see a user layout with missing dynamic style values, fall back to default
					value: componentLayout.dynamicStyles?.[styleID] ?? defaultComponentLayout?.dynamicStyles?.[styleID]
				};

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

	get position(): LayoutUtil.Position {
		return $.StructuredClone(this._position);
	}

	set position(position: LayoutUtil.Position) {
		this._position = $.StructuredClone(position);
		LayoutUtil.setPosition(this.panel, this._position);
	}

	get size(): LayoutUtil.Size | undefined {
		return this._size ? $.StructuredClone(this._size) : undefined;
	}

	set size(size: LayoutUtil.Size | undefined) {
		this._size = size ? $.StructuredClone(size) : undefined;
		if (this._size) {
			LayoutUtil.setPositionAndSize(this.panel, this._position, this._size);
		} else {
			LayoutUtil.setPosition(this.panel, this._position);
		}
	}

	getLayout(): ComponentLayout {
		const layout: ComponentLayout = {
			position: this.position,
			size: this.size,
			enabled: this.enabled
		};

		if (this.dynamicStyles) {
			layout.dynamicStyles = {};

			for (const [styleID, dynamicStyle] of Object.entries(this.dynamicStyles)) {
				layout.dynamicStyles[styleID] = dynamicStyle.value;
			}
		}

		return layout;
	}

	reset(): void {
		const defaultComponentLayout = Component.defaultLayout.components?.[this.id];
		if (!defaultComponentLayout)
			throw new Error(`HudCustomizer: Could not load default layout for HUD customizer component ${this.id}`);

		this.position = defaultComponentLayout.position;
		this.size = defaultComponentLayout.size ?? undefined;
		this.enabled = defaultComponentLayout.enabled ?? true;

		for (const [styleID, dynamicStyle] of Object.entries(this.dynamicStyles ?? {})) {
			const defaultValue = defaultComponentLayout.dynamicStyles?.[styleID];
			if (defaultValue != null) {
				dynamicStyle.value = defaultValue;
				this.applyDynamicStyle(dynamicStyle);
			}
		}
	}

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

		if ('styleProperty' in style.properties) {
			// We have extremely strong types in the common/hud-customizer.ts stuff to constrain dynamicStyles to
			// valid combinations. Proving to the TS that everything is valid here is a pain though, not worth it.
			const styleValue = style.properties.valueFn?.(style.value as any) ?? style.value;

			if (styleValue != null) {
				for (const panel of targetPanels) {
					(panel.style as any)[style.properties.styleProperty] = styleValue;
				}
			}
		} else {
			if (!('func' in style.properties)) {
				throw new Error('Invalid dynamic style, missing styleProperty or className');
			}

			for (const panel of targetPanels) {
				style.properties.func(panel, style.value as any);
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
		// registerHUDCustomizerComponent(this.panels.settings, {
		// 	resizeY: false,
		// 	resizeX: false,
		// 	marginSettings: false,
		// 	paddingSettings: false,
		// 	backgroundColorSettings: false
		// });

		$.RegisterForUnhandledEvent('HudCustomizer_Enabled', () => this.enableEditing());
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

	loadComponent(panel: GenericPanel, properties: CustomizerComponentProperties): void {
		if (!panel) return;

		const component = Component.register(panel, properties);
		this.components[component.id] = component;

		this.generateComponentList();
	}

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

		this.panels.customizer.saveLayout(saveData);
	}

	enableEditing(): void {
		if (!this.components || Object.keys(this.components).length === 0) {
			throw new Error('We werent loaded! Fuck!!');
		}

		for (const component of Object.values(this.components)) {
			component.panel.SetPanelEvent('onmouseover', () => this.setActiveComponent(component));
		}

		this.createGridLines();
		this.updateGridVisibility();
		this.createResizeKnobs();

		this.activeComponent ??= this.components[Object.keys(this.components)[0]];
		this.setActiveComponent(this.activeComponent);
	}

	disableEditing(): void {
		for (const component of Object.values(this.components)) {
			component.panel.ClearPanelEvent('onmouseover');
		}

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.dragPanel, this.dragStartHandle);
		}
	}

	toggle(enable: boolean) {
		this.panels.customizer.toggleUI(enable);
	}

	generateComponentList() {
		this.panels.componentList.RemoveAndDeleteChildren();

		for (const [id, component] of Object.entries(this.components)) {
			const panel = $.CreatePanel('RadioButton', this.panels.componentList, `${id}Settings`);
			panel.LoadLayoutSnippet('component');
			panel.SetDialogVariable('name', id);
			panel.SetSelected(this.activeComponent === component);
			panel.SetPanelEvent('onactivate', () => this.setActiveComponent(component));

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
		this.activeComponent = component;

		const [[x, y], [w, h]] = LayoutUtil.getPositionAndSize(component.panel);

		// Set the virtual panel's position and size to the component we just hovered over
		// TODO: conditional styling based on if top bit is too close to top of screen
		LayoutUtil.setPositionAndSize(
			this.panels.overlay,
			[x, y - OVERLAY_HEADER_HEIGHT],
			[w, h + OVERLAY_HEADER_HEIGHT]
		);

		LayoutUtil.setPositionAndSize(this.panels.dragPanel, [x, y], [w, h]);

		this.panels.overlay.SetDialogVariable('name', this.activeComponent.panel.id);
		this.updateActiveComponentSettings();
		this.updateActiveComponentDialogVars();

		this.panels.resizeKnobs.SetHasClass(
			'hud-customizer-overlay__resize-knobs--resize-x',
			component.properties.resizeX
		);
		this.panels.resizeKnobs.SetHasClass(
			'hud-customizer-overlay__resize-knobs--resize-y',
			component.properties.resizeY
		);

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

					// TODO: shit
					if (dynamicStyle.properties.eventListeners) {
						for (const { event, panel: targetPanel, callback } of dynamicStyle.properties.eventListeners) {
							$.RegisterEventHandler(event, targetPanel, (panel) => {
								callback(panel, value);
							});
						}
					}
				}
			}
		}
	}

	resetComponent(component: Component): void {
		component.reset();

		// (1 day later: refactored a ton dunno if still applieos)
		// TODO NEXT: something funky going on here, isn't moving overlay, and dragging no longer causes w/h/x/y values to update?
		this.setActiveComponent(component);
	}

	onStartDrag(mode: DragMode, displayPanel: Panel, _panelID: string, callback: DragEventInfo) {
		if (!this.activeComponent) return;

		this.dragMode = mode;

		this.onThinkHandle = $.RegisterEventHandler('HudThink', this.panels.customizer, () => this.onDragThink());

		if (this.dragMode !== DragMode.MOVE) {
			callback.offsetX = 0;
			callback.offsetY = 0;
		} else {
			this.panels.overlay.AddClass('hud-customizer-overlay-dragging');
		}

		callback.displayPanel = displayPanel;
		callback.removePositionBeforeDrop = false;
	}

	onDragThink(): void {
		if (!this.activeComponent || this.dragMode === undefined) return;

		if (this.dragMode === DragMode.MOVE) {
			// TODO next: updating individual pos/size elems completely breakings everything, never do it!!
			
			// Update component JS position based on drag panel position, possibly snapping
			this.handleMoveSnapping();

			// Push updates to overlay, which isn't attached to drag panel either
			LayoutUtil.setPosition(this.panels.overlay, [
				this.activeComponent.position[0],
				this.activeComponent.position[1] - OVERLAY_HEADER_HEIGHT
			]);
		} else {
			if (!this.activeComponent.size) return;

			// Resize component JS size and position knob position, possibly snapping
			this.handleResizeSnapping();

			// Push updates to overlay. Drag panel will get updated on drag end
			LayoutUtil.setPositionAndSize(
				this.panels.overlay,
				[this.activeComponent.position[0], this.activeComponent.position[1] - OVERLAY_HEADER_HEIGHT],
				[this.activeComponent.size[0], this.activeComponent.size[1] + OVERLAY_HEADER_HEIGHT]
			);
		}

		this.updateActiveComponentDialogVars();
	}

	onEndDrag() {
		if (!this.activeComponent) return;

		if (this.onThinkHandle == null) {
			throw new Error('onEndDrag called with invalid handler somehow');
		}

		this.onDragThink(); // call the last think to ensure the final position is set

		$.UnregisterEventHandler('HudThink', this.panels.customizer, this.onThinkHandle);

		if (this.activeComponent.size) {
			LayoutUtil.setPositionAndSize(
				this.panels.dragPanel,
				this.activeComponent.position,
				this.activeComponent.size
			);
		} else {
			LayoutUtil.setPosition(this.panels.dragPanel, this.activeComponent.position);
		}

		this.panels.overlay.RemoveClass('hud-customizer-overlay--dragging');

		this.activeGridlines?.forEach((line) => line?.panel.RemoveClass('hud-customizer-grid__line--highlight'));
		this.activeGridlines = [undefined, undefined];

		// TODO: this is just for testing
		this.save();

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
				this.activeComponent.position[axis] = centerGridline.offset - panelSize / 2;
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
				this.activeComponent.position[axis] = LayoutUtil.getPosition(this.panels.dragPanel)[axis];
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
				this.activeComponent.position[axis] = this.gridlines[axis][leftIndex].offset;
				this.setActiveGridline(axis, this.gridlines[axis][leftIndex]);
			} else {
				this.activeComponent.position[axis] = this.gridlines[axis][rightIndex!].offset - panelSize;
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

		this.panels.overlay.SetDialogVariable('x', fixFloat(this.activeComponent.position[0]).toFixed(2));
		this.panels.overlay.SetDialogVariable('y', fixFloat(this.activeComponent.position[1]).toFixed(2));

		if (this.activeComponent.size) {
			this.panels.overlay.SetDialogVariable('width', fixFloat(this.activeComponent.size[0]).toFixed(2));
			this.panels.overlay.SetDialogVariable('height', fixFloat(this.activeComponent.size[1]).toFixed(2));
		} else {
			this.panels.overlay.SetDialogVariable('width', 'fit');
			this.panels.overlay.SetDialogVariable('height', 'fit');
		}
	}

	readonly ResizeVectors = {
		[DragMode.RESIZE_TOP]: [0, -1],
		[DragMode.RESIZE_TOP_RIGHT]: [1, -1],
		[DragMode.RESIZE_RIGHT]: [1, 0],
		[DragMode.RESIZE_BOTTOM_RIGHT]: [1, 1],
		[DragMode.RESIZE_BOTTOM]: [0, 1],
		[DragMode.RESIZE_BOTTOM_LEFT]: [-1, 1],
		[DragMode.RESIZE_LEFT]: [-1, 0],
		[DragMode.RESIZE_TOP_LEFT]: [1, -1]
	};

	handleResizeSnapping(): void {
		if (!this.activeComponent || !this.activeComponent.size || this.dragMode === undefined) return;

		const minSize = getMinSize(this.activeComponent.panel);
		const resizeDir = this.ResizeVectors[this.dragMode] ?? [0, 0];
		const knobPos = LayoutUtil.getPosition(this.panels.dragResizeKnob);
		const newPos: LayoutUtil.Position = [knobPos[0], knobPos[1]];
		const shouldSnap = this.panels.snappingToggle.checked;

		for (const axis of Axes) {
			const gridGapLength = this.getGridGapLength(axis);

			// TODO: If panel is below minsize, stop setting gridline
			// Also, do we really want minSize set in CSS, or should we do a customizer property thing? Maybe default
			// to something very small (to disallow making buggy components with 0 width/height, then allow overriding?
			if (shouldSnap) {
				for (const gl of this.gridlines[axis]) {
					const dist = Math.abs(gl.offset - knobPos[axis]);
					if (dist <= SNAPPING_THRESHOLD * gridGapLength) {
						newPos[axis] = gl.offset;
						this.setActiveGridline(axis, gl);
						break;
					}
				}
			} else {
				this.setActiveGridline(axis, undefined);
			}

			if (resizeDir[axis] === 1) {
				this.activeComponent.size[axis] = Math.max(
					newPos[axis] - this.activeComponent.position[axis],
					minSize[axis]
				);
			} else if (resizeDir[axis] === -1) {
				this.activeComponent.size[axis] += this.activeComponent.position[axis] - newPos[axis];
				const offset =
					Math.max(this.activeComponent.size[axis], minSize[axis]) - this.activeComponent.size[axis];
				this.activeComponent.size[axis] += offset;
				this.activeComponent.position[axis] = newPos[axis] - offset;
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

				LayoutUtil.setPosition(gridline, isX ? [offset, 0] : [0, offset]);

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
					hittest: true
				});

				$.RegisterEventHandler('DragStart', knob, (...args) => {
					this.onStartDrag(dir, this.panels.dragResizeKnob, ...args);
				});
				$.RegisterEventHandler('DragEnd', knob, () => {
					this.onEndDrag();
				});

				this.resizeKnobs[dir] = knob;
			});
	}

	fixWonkyBounds(panel: GenericPanel, position: LayoutUtil.Position, size: LayoutUtil.Size): LayoutUtil.Position {
		return position.map((len, axis) => {
			if (Number.isNaN(len)) {
				$.Warning(`HudCustomizer: Loaded invalid position ${len} for axis ${Axis[Axes[axis]]}, setting to 0.`);
				len = 0;
			}

			const isX = axis === 0;
			const max = isX ? MAX_X_POS : MAX_Y_POS;
			const panelLen = size[axis];

			if (len < -MAX_OOB) {
				$.Warning(`HudCustomizer: Panel ${panel.id} is too far off-screen (X = ${len}), nudging on-screen.`);
				len = 0;
			} else if (len + panelLen > max - MAX_OOB) {
				$.Warning(`HudCustomizer: Panel ${panel.id} is too far off-screen (Y = ${len}), nudging on-screen.`);
				len = max - panelLen;
			}

			return len;
		}) as LayoutUtil.Position;
	}
}

function fixFloat(n: number) {
	return +n.toFixed(4);
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
