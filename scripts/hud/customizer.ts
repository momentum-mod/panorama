import * as LayoutUtil from 'common/layout';
import * as Enum from 'util/enum';
import { PanelHandler } from 'util/module-helpers';

/** Structure of layout stored out to KV3 */
export interface HudLayout {
	components: {
		[id: string]: {
			position: LayoutUtil.Position;
			size: LayoutUtil.Size;
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
class HudCustomizerHandler {
	readonly panels = {
		hudRoot: $.GetContextPanel().GetParent()!,
		customizer: $.GetContextPanel<HudCustomizer>()!,
		dragPanel: $<Panel>('#DragPanel')!,
		dragResizeKnob: $<Panel>('#DragKnob')!,
		overlay: $<Panel>('#Overlay')!,
		activeName: $<Label>('#ActiveName')!,
		resizeKnobs: $<Panel>('#ResizeKnobs')!,
		grid: $.GetContextPanel().GetParent()!.FindChildTraverse('HudCustomizerGrid')!,
		gridToggle: $<ToggleButton>('#GridToggle')!,
		gridSize: $<NumberEntry>('#GridSize')!,
		snappingToggle: $<ToggleButton>('#SnappingToggle')!
	};

	private components: Record<string, Component> = undefined!;
	private gridlines: GridlineForAxis = [[], []];
	private activeComponent?: Component | undefined;
	private activeGridlines: [Gridline | undefined, Gridline | undefined] = [undefined, undefined];

	private resizeKnobs: Record<ResizeMode, Button> = undefined!;

	private dragStartHandle?: number;
	private dragEndHandle?: number;
	private onThinkHandle?: number;

	private dragMode?: DragMode;

	private gridSize: number = undefined!;
	private enableGrid: boolean = undefined!;
	private enableSnapping: boolean = undefined!;

	private defaultLayout?: HudLayout;

	constructor() {
		// TODO: Move to own thing! Zonemenu will be v helpful reference
		$.RegisterForUnhandledEvent('HudChat_Show', () => this.enableEditing());
		$.RegisterForUnhandledEvent('HudChat_Hide', () => this.disableEditing());

		if ((this.panels.hudRoot.paneltype as string) !== 'Hud') {
			throw new Error("Hud Customizer: Customizer's parent panel is not the HUD.");
		}

		// TODO: I *think* we're gonna need this event to cover all cases where the HUD is reloaded.
		// Looks like some stuff like HudSpecInfoHandler listening for PanelLoaded is getting
		// called later than this though...
		$.RegisterForUnhandledEvent('HudInit' as any, () => {
			this.load();
		});
	}

	public enableEditing(): void {
		if (!this.components || Object.keys(this.components).length === 0) {
			throw new Error('We werent loaded! Fuck!!');
		}

		this.panels.customizer.AddClass('hud-customizer--enabled');

		for (const component of Object.values(this.components)) {
			component.panel.AddClass('hud-customizable');
			component.panel.SetPanelEvent('onmouseover', () => this.onComponentMouseOver(component));
		}
	}

	public disableEditing(): void {
		this.panels.customizer.RemoveClass('hud-customizer--enabled');
		for (const component of Object.values(this.components)) {
			component.panel.RemoveClass('hud-customizable');
			component.panel.ClearPanelEvent('onmouseover');
		}

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.dragPanel, this.dragStartHandle);
		}
	}

	private load(): void {
		this.gridlines = [[], []];
		this.activeGridlines = [undefined, undefined];
		this.activeComponent = undefined;

		const layoutData = this.panels.customizer.getLayout();

		this.loadSettings(layoutData);
		this.loadComponents(layoutData);
		this.createGridLines();
		this.updateGridVisibility();
		this.createResizeKnobs();
	}

	private loadSettings(layoutData: HudLayout): void {
		this.gridSize = layoutData.settings?.gridSize ?? DEFAULT_GRID_SIZE;
		this.panels.gridSize.value = this.gridSize;

		this.enableGrid = layoutData?.settings?.enableGrid ?? DEFAULT_GRID_ENABLED;
		this.panels.gridToggle.checked = this.enableGrid;

		this.enableSnapping = layoutData?.settings?.enableSnapping ?? DEFAULT_SNAP_ENABLED;
		this.panels.snappingToggle.checked = this.enableSnapping;
	}

	private loadComponents(layoutData: HudLayout): void {
		this.components = {};
		for (const panel of this.getCustomizablePanels()) {
			const component = layoutData?.components?.[panel.id] ?? this.getDefaultComponent(panel);
			if (component) {
				const pos = this.fixWonkyBounds(panel, component.position, component.size);
				this.components[panel.id] = { panel, position: pos, size: component.size };
			}
		}
	}

	private save(): void {
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
				size: [fixFloat(w), fixFloat(h)]
			};
		}

		this.panels.customizer.saveLayout(saveData);
	}

	private getCustomizablePanels() {
		return this.panels.hudRoot
			.Children()
			.filter((panel) => panel.GetAttributeString('customizable', 'false') === 'true');
	}

	private getDefaultComponent(panel: GenericPanel): Component {
		// Load and cache defaults
		this.defaultLayout ??= this.panels.customizer.getDefaultLayout();

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

	private onComponentMouseOver(component: Component): void {
		if (this.activeComponent && this.activeComponent === component) return;

		// TODO: Can probably apply all this kind of stylign to the overlay, not the underlying component panel.
		this.activeComponent?.panel.RemoveClass('hud-customizable--active');

		this.activeComponent = component;

		this.activeComponent.panel.AddClass('hud-customizable--active');

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
		this.panels.activeName.text = this.activeComponent.panel.id;

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

	private onStartDrag(mode: DragMode, displayPanel: Panel, _panelID: string, callback: DragEventInfo) {
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

	private onDragThink(): void {
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
	}

	private onEndDrag() {
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

	private handleMoveSnapping(): void {
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

	private setActiveGridline(axis: Axis, gridline: Gridline | undefined): void {
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

	private readonly ResizeVectors = {
		[DragMode.RESIZE_TOP]: [0, -1],
		[DragMode.RESIZE_TOP_RIGHT]: [1, -1],
		[DragMode.RESIZE_RIGHT]: [1, 0],
		[DragMode.RESIZE_BOTTOM_RIGHT]: [1, 1],
		[DragMode.RESIZE_BOTTOM]: [0, 1],
		[DragMode.RESIZE_BOTTOM_LEFT]: [-1, 1],
		[DragMode.RESIZE_LEFT]: [-1, 0],
		[DragMode.RESIZE_TOP_LEFT]: [1, -1]
	};

	private handleResizeSnapping(): void {
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

	private createGridLines(): void {
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

	public updateGridVisibility(): void {
		const enabled = this.panels.gridToggle.checked;
		this.panels.grid.SetHasClass('hud-customizer-grid--enabled', enabled);
		this.panels.gridSize.enabled = enabled;
		this.panels.snappingToggle.enabled = enabled;
	}

	public updateGridSize(): void {
		const newSize = this.panels.gridSize.value;

		if (newSize !== this.gridSize) {
			this.gridSize = newSize;
			this.createGridLines();
		}
	}

	private getGridGapLength(axis: Axis): number {
		return (axis === Axis.X ? MAX_X_POS : MAX_Y_POS) / this.gridlines[axis].length;
	}

	private createResizeKnobs(): void {
		this.resizeKnobs = {} as Record<any, any>;

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

	private fixWonkyBounds(
		panel: GenericPanel,
		position: LayoutUtil.Position,
		size: LayoutUtil.Size
	): LayoutUtil.Position {
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
	return +n.toFixed(3);
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
