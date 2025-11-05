import * as LayoutUtil from 'common/layout';
import * as Enum from 'util/enum';
import { PanelHandler } from 'util/module-helpers';
import {
	CustomizerComponentProperties,
	CustomizerPropertyType,
	DynamicStyle,
	IHudCustomizerHandler,
	QuerySelector,
	registerHUDCustomizerComponent,
	StyleID
} from 'common/hud-customizer';

/** Structure of layout stored out to KV3 */
interface HudLayout {
	components: {
		[id: string]: {
			position: LayoutUtil.Position;
			size: LayoutUtil.Size;
			dynamicStyles?: Record<StyleID, unknown>;
		};
	};
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

interface Component {
	panel: GenericPanel;
	dynamicStyles?: Record<StyleID, DynamicStyle & { value: unknown }>;
	// Temp values for position and size that makes a lot of code simpler.
	// These do *not* update the actual panel until you use LayoutUtil to set them.
	position: LayoutUtil.Position;
	size: LayoutUtil.Size;
}

interface Gridline {
	panel: Panel;
	offset: number;
}

type GridlineForAxis = [Gridline[], Gridline[]];

@PanelHandler()
class HudCustomizerHandler implements IHudCustomizerHandler {
	readonly panels = {
		hudRoot: $.GetContextPanel().GetParent()!,
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
		if ((this.panels.hudRoot.paneltype as string) !== 'Hud') {
			throw new Error("Hud Customizer: Customizer's parent panel is not the HUD.");
		}

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

			// TODO: not working :(
			registerHUDCustomizerComponent(this.panels.settings, { resizeY: false, resizeX: false });
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

		UiToolkitAPI.GetGlobalObject()['HudCustomizerHandler'] = this;
	}

	loadComponent(panel: GenericPanel, properties: CustomizerComponentProperties): void {
		if (!panel) return;

		const component = this.layout?.components?.[panel.id] ?? this.getDefaultComponent(panel);
		if (!component) return;

		const pos = this.fixWonkyBounds(panel, component.position, component.size);
		this.components[panel.id] = {
			panel,
			position: pos,
			size: component.size,
			dynamicStyles: properties.dynamicStyles as any // TODO:, have to parse saved values into dynamic stuff
		};

		LayoutUtil.setPositionAndSize(panel, pos, component.size);

		if (properties.dynamicStyles) {
			for (const styleID of Object.keys(properties.dynamicStyles)) {
				const savedValue = this.layout?.components?.[panel.id]?.dynamicStyles?.[styleID];
				if (savedValue != null) {
					this.applyDynamicStyle(
						this.components[panel.id],
						styleID,
						properties.dynamicStyles[styleID] as DynamicStyle,
						savedValue
					);
				}
			}
		}

		this.generateComponentList();
	}

	getDefaultComponent(panel: GenericPanel): Component {
		// Load and cache defaults
		this.defaultLayout ??= this.panels.customizer.getDefaultLayout();

		if (!this.defaultLayout) {
			throw new Error('HudCustomizer: Could not load default layout for HUD customizer!');
		}

		const defaults = this.defaultLayout.components[panel.id];
		if (!defaults || !Array.isArray(defaults.position) || !Array.isArray(defaults.size)) {
			// TODO: Should probably make this an error when proejct is completed, too annoying to do rn.
			$.Warning(
				`HudCustomizer: Found a customizable HUD element ${panel.paneltype} that doesn't have a default layout!`
			);

			return { panel, position: LayoutUtil.getPosition(panel), size: LayoutUtil.getSize(panel) };
		}

		return { panel, position: defaults.position, size: defaults.size };
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
			const [[x, y], [w, h]] = LayoutUtil.getPositionAndSize(component.panel);
			saveData.components[id] = {
				position: [fixFloat(x), fixFloat(y)],
				size: [fixFloat(w), fixFloat(h)],
				dynamicStyles: Object.fromEntries(
					Object.entries(component.dynamicStyles ?? {}).map(([styleID, { value }]) => [styleID, value])
				)
			};
		}

		this.panels.customizer.saveLayout(saveData);
	}

	enableEditing(): void {
		if (!this.components || Object.keys(this.components).length === 0) {
			throw new Error('We werent loaded! Fuck!!');
		}

		for (const component of Object.values(this.components)) {
			component.panel.SetPanelEvent('onmouseover', () => this.selectComponent(component));
		}

		this.createGridLines();
		this.updateGridVisibility();
		this.createResizeKnobs();
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
			const panel = $.CreatePanel('ToggleButton', this.panels.componentList, `${id}Settings`);
			panel.LoadLayoutSnippet('component');
			panel.SetDialogVariable('name', id);
			panel.SetSelected(this.activeComponent === component);
			panel.SetPanelEvent('onactivate', () => {
				this.selectComponent(component);
			});
		}
	}

	selectComponent(component: Component): void {
		if (this.activeComponent && this.activeComponent === component) return;

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

		// TODO: This is going to be weird to localise!
		this.panels.overlay.SetDialogVariable('name', this.activeComponent.panel.id);
		this.updateActiveComponentSettings();

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

		if (!this.activeComponent?.dynamicStyles || Object.keys(this.activeComponent.dynamicStyles).length === 0) {
			this.panels.activeComponentSettings.visible = false;
			return;
		}

		this.panels.activeComponentSettings.visible = true;
		this.panels.settings.SetDialogVariable('active_name', this.activeComponent.panel.id);

		for (const [styleID, dynamicStyle] of Object.entries(this.activeComponent.dynamicStyles ?? {})) {
			const panel = $.CreatePanel('Panel', this.panels.activeComponentSettingsList, '');

			switch (dynamicStyle.type) {
				case CustomizerPropertyType.NUMBER_ENTRY: {
					panel.LoadLayoutSnippet('dynamic-numberentry');
					panel.SetDialogVariable('name', dynamicStyle.name);
					const numberEntry = panel.FindChildTraverse<NumberEntry>('NumberEntry')!;

					if (dynamicStyle.settingProps) Object.assign(numberEntry, dynamicStyle.settingProps);

					numberEntry.SetPanelEvent('onvaluechanged', () =>
						this.applyDynamicStyle(this.activeComponent, styleID, dynamicStyle, numberEntry.value)
					);

					break;
				}

				case CustomizerPropertyType.CHECKBOX: {
					panel.LoadLayoutSnippet('dynamic-checkbox');
					panel.SetDialogVariable('name', dynamicStyle.name);
					const checkbox = panel.FindChildTraverse<ToggleButton>('ToggleButton')!;

					if (dynamicStyle.settingProps) Object.assign(checkbox, dynamicStyle.settingProps);

					checkbox.SetPanelEvent('onactivate', () =>
						this.applyDynamicStyle(this.activeComponent, styleID, dynamicStyle, checkbox.checked)
					);

					break;
				}

				case CustomizerPropertyType.COLOR_PICKER: {
					panel.LoadLayoutSnippet('dynamic-colorpicker');
					const colorDisplay = panel.FindChild<ColorDisplay>('ColorDisplay')!;
					colorDisplay.title = dynamicStyle.name;

					colorDisplay.SetPanelEvent('oncolorchange', () =>
						this.applyDynamicStyle(this.activeComponent, styleID, dynamicStyle, colorDisplay.color)
					);

					break;
				}
			}
		}
	}

	applyDynamicStyle(component: Component | undefined, id: string, dynamicStyle: DynamicStyle, value: unknown): void {
		if (!component) return;

		const targetPanels: GenericPanel[] = [];

		if (dynamicStyle.targetPanel) {
			if (Array.isArray(dynamicStyle.targetPanel)) {
				for (const selector of dynamicStyle.targetPanel) {
					const target = dollarSignLookup(component.panel, selector);
					if (Array.isArray(target)) {
						for (const t of target) {
							targetPanels.push(t);
						}
					} else if (target) {
						targetPanels.push(target);
					}
				}
			} else {
				const target = dollarSignLookup(component.panel, dynamicStyle.targetPanel);
				if (Array.isArray(target)) {
					for (const t of target) {
						targetPanels.push(t);
					}
				} else if (target) {
					targetPanels.push(target);
				}
			}
		} else {
			targetPanels.push(component.panel);
		}

		if ('styleProperty' in dynamicStyle) {
			// Note: We have extremely strong types in the common/hud-customizer.ts stuff
			// to constrain dynamicStyles to valid combinations. Proving to the TS that everything
			// is valid here is a pain though, not worth it.
			const styleValue = dynamicStyle.valueFn?.(value as any) ?? value;

			if (styleValue != null) {
				for (const panel of targetPanels) {
					(panel.style as any)[dynamicStyle.styleProperty] = styleValue;
				}
			}
		} else {
			if (!('func' in dynamicStyle)) {
				throw new Error('Invalid dynamic style, missing styleProperty or className');
			}

			for (const panel of targetPanels) {
				dynamicStyle.func(panel, value as any);
			}
		}

		component.dynamicStyles ??= {};
		component.dynamicStyles[id].value = value;
	}

	onStartDrag(mode: DragMode, displayPanel: Panel, _panelID: string, callback: DragEventInfo) {
		if (!this.activeComponent) return;

		this.dragMode = mode;

		this.onThinkHandle = $.RegisterEventHandler('HudThink', this.panels.customizer, () => this.onDragThink());

		if (this.dragMode !== DragMode.MOVE) {
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

			// Push updates to the actual panel and overlay, which isn't attached to drag panel either
			LayoutUtil.setPosition(this.activeComponent.panel, this.activeComponent.position);
			LayoutUtil.setPosition(this.panels.overlay, [
				this.activeComponent.position[0],
				this.activeComponent.position[1] - OVERLAY_HEADER_HEIGHT
			]);
		} else {
			// Resize component JS size and position knob position, possibly snapping
			this.handleResizeSnapping();

			// Push updates to the actual panel and overlay. Drag panel will get updated on drag end
			LayoutUtil.setPositionAndSize(
				this.activeComponent.panel,
				this.activeComponent.position,
				this.activeComponent.size
			);
			LayoutUtil.setPositionAndSize(
				this.panels.overlay,
				[this.activeComponent.position[0], this.activeComponent.position[1] - OVERLAY_HEADER_HEIGHT],
				[this.activeComponent.size[0], this.activeComponent.size[1] + OVERLAY_HEADER_HEIGHT]
			);
		}

		this.panels.overlay.SetDialogVariable('x', fixFloat(this.activeComponent.position[0]).toString());
		this.panels.overlay.SetDialogVariable('y', fixFloat(this.activeComponent.position[1]).toString());
		this.panels.overlay.SetDialogVariable('width', fixFloat(this.activeComponent.size[0]).toString());
		this.panels.overlay.SetDialogVariable('height', fixFloat(this.activeComponent.size[1]).toString());
	}

	onEndDrag() {
		if (!this.activeComponent) return;

		if (this.onThinkHandle == null) {
			throw new Error('onEndDrag called with invalid handler somehow');
		}

		this.onDragThink(); // call the last think to ensure the final position is set

		$.UnregisterEventHandler('HudThink', this.panels.customizer, this.onThinkHandle);

		LayoutUtil.setPositionAndSize(this.panels.dragPanel, this.activeComponent.position, this.activeComponent.size);

		this.activeComponent.panel.RemoveClass('hud-customizable--dragging');
		this.panels.dragPanel.RemoveClass('hud-customizer-overlay--dragging');

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

			// Nothing to snap, set to wherever the drag panel is
			if (leftIndex === undefined && rightIndex === undefined) {
				this.activeComponent.position[axis] = LayoutUtil.getPosition(this.panels.dragPanel)[axis];
				this.setActiveGridline(axis, undefined);
				continue;
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
		if (!this.activeComponent || this.dragMode === undefined) return;

		const minSize = getMinSize(this.activeComponent.panel);
		const resizeDir = this.ResizeVectors[this.dragMode] ?? [0, 0];
		const knobPos = LayoutUtil.getPosition(this.panels.dragResizeKnob);
		const newPos: LayoutUtil.Position = [knobPos[0], knobPos[1]];
		const shouldSnap = this.panels.snappingToggle.checked;

		for (const axis of Axes) {
			const gridGapLength = this.getGridGapLength(axis);

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
				if (i === numLines / 2) cssClass += ' hud-customizer-grid__line--center';
				if (i === 0 || i === numLines) cssClass += 'hud-customizer-grid__line--edge';

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

/** JSDollarSign $. style lookup in JS */
function dollarSignLookup<T extends Panel>(panel: GenericPanel, selector: QuerySelector): T | T[] | null {
	return selector.startsWith('#')
		? (panel.FindChildTraverse(selector.slice(1)) as T | null)
		: (panel.FindChildrenWithClassTraverse(selector.slice(1)) as T[] | null);
}
