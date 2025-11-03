import * as LayoutUtil from 'common/layout';
import * as Enum from 'util/enum';
import { PanelHandler } from 'util/module-helpers';

/** Structure of layout stored out to KV3 */
export interface HudLayout {
	components: {
		[id: string]: {
			position: LayoutUtil.Position;
			size: LayoutUtil.Size;
			snaps: [number, number];
		};
	};
	settings: {
		gridSize: number;
	};
}

enum Axis {
	X = 0,
	Y = 1
}

const Axes = [Axis.X, Axis.Y] as const;

type Snaps = [SnapMode, SnapMode];

/**
 * The four different snapping behaviours
 *
 * For a horizontal panel, min and max are left and right respectively, for vertical, top and bottom
 */
enum SnapMode {
	MIN = 1,
	MID = 2,
	MAX = 3,
	OFF = 4
}

// Tuple of X, Y axis snaps respectively
const DEFAULT_SNAP_MODES: Snaps = [SnapMode.OFF, SnapMode.OFF];

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

const RESIZE_VECTOR: Record<ResizeMode, [number, number]> = {
	[DragMode.RESIZE_TOP]: [0, -1],
	[DragMode.RESIZE_TOP_RIGHT]: [1, -1],
	[DragMode.RESIZE_RIGHT]: [1, 0],
	[DragMode.RESIZE_BOTTOM_RIGHT]: [1, 1],
	[DragMode.RESIZE_BOTTOM]: [0, 1],
	[DragMode.RESIZE_BOTTOM_LEFT]: [-1, 1],
	[DragMode.RESIZE_LEFT]: [-1, 0],
	[DragMode.RESIZE_TOP_LEFT]: [1, -1]
} satisfies Record<ResizeMode, [number, number]> as any;

const DEFAULT_GRID_SIZE = 5;
const MAX_X_POS = 1920;
const MAX_Y_POS = 1080;
const MAX_OOB = 16;

interface Component {
	panel: GenericPanel;
	snaps: Snaps;
	position: LayoutUtil.Position;
	size: LayoutUtil.Size;
	properties?: Record<string, unknown>;
}

interface Gridline {
	panel: Panel;
	offset: number;
}

type GridlineForAxis = [Gridline[], Gridline[]];

const SNAPS: Record<Axis, Record<SnapMode, { name: string; button: RadioButton; sizeFactor: number }>> = {
	[Axis.X]: {
		[SnapMode.MIN]: { name: 'Left', button: $<RadioButton>('#SnapsXMin')!, sizeFactor: 0 },
		[SnapMode.MID]: { name: 'Center', button: $<RadioButton>('#SnapsXMid')!, sizeFactor: 0.5 },
		[SnapMode.MAX]: { name: 'Right', button: $<RadioButton>('#SnapsXMax')!, sizeFactor: 1 },
		[SnapMode.OFF]: { name: 'None', button: $<RadioButton>('#SnapsXOff')!, sizeFactor: 0 }
	},
	[Axis.Y]: {
		[SnapMode.MIN]: { name: 'Top', button: $<RadioButton>('#SnapsYMin')!, sizeFactor: 0 },
		[SnapMode.MID]: { name: 'Center', button: $<RadioButton>('#SnapsYMid')!, sizeFactor: 0.5 },
		[SnapMode.MAX]: { name: 'Bottom', button: $<RadioButton>('#SnapsYMax')!, sizeFactor: 1 },
		[SnapMode.OFF]: { name: 'None', button: $<RadioButton>('#SnapsYOff')!, sizeFactor: 0 }
	}
};

@PanelHandler()
class HudCustomizerHandler {
	readonly panels = {
		hudRoot: $.GetContextPanel().GetParent()!,
		customizer: $.GetContextPanel<HudCustomizer>()!,
		dragPanel: $<Panel>('#DragPanel')!,
		overlay: $<Panel>('#Overlay')!,
		activeName: $<Label>('#ActiveName')!,
		activeSnaps: $('#ActiveSnaps')!,
		resizeKnobs: $<Panel>('#ResizeKnobs')!, // TODO: Why is this is the outer bit?? Surely should be in virtual stuff?
		grid: $.GetContextPanel().GetParent()!.FindChildTraverse('HudCustomizerGrid')!,
		gridSize: $<NumberEntry>('#GridSize')!
	};

	private components: Record<string, Component> = undefined!;
	private gridlines: GridlineForAxis = [[], []];
	private activeComponent?: Component | undefined;
	private activeGridlines: [Gridline | undefined, Gridline | undefined] = [undefined, undefined];

	// `${ResizeMode}` allows us to return correctly typed values from recordEntries and convert them explicitly back into ResizeMode
	private resizeKnobs: Record<`${ResizeMode}`, Button> = undefined!;

	private dragStartHandle?: number;
	private dragEndHandle?: number;
	private onThinkHandle?: number;

	private dragMode?: DragMode;

	private gridSize = DEFAULT_GRID_SIZE;

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
		// Onload calls load() too early so have to do this
		// TODO: I don't know why the above is the case, clearly shitty behaviour, figure it out!

		if (!this.components || Object.keys(this.components).length === 0) {
			throw new Error('We werent loaded! Fuck!!');

			this.load();
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

		this.gridSize = layoutData?.settings?.gridSize ?? DEFAULT_GRID_SIZE;
		this.panels.gridSize.value = this.gridSize;

		this.createGridLines();

		this.resizeKnobs = {} as Record<any, any>;
		for (const dir of Enum.fastValuesNumeric(DragMode)) {
			if (dir === DragMode.MOVE) continue; // handled in onComponentMouseOver

			this.resizeKnobs[dir] = $.CreatePanel('Button', this.panels.customizer, `Resize_${DragMode[dir]}`, {
				class: 'hud-customizer__resize-knob',
				draggable: true,
				hittest: true
			});

			// $.RegisterEventHandler('DragStart', this.resizeKnobs[dir], (...args) => {
			// 	this.onStartDrag(dir, this.panels.virtualKnob, ...args);
			// });
			// $.RegisterEventHandler('DragEnd', this.resizeKnobs[dir], () => {
			// 	this.onEndDrag();
			// });
		}

		this.components = {};
		for (const panel of this.getCustomizablePanels()) {
			const component = layoutData?.components?.[panel.id] ?? this.getDefaultComponent(panel);
			if (component) {
				this.components[panel.id] = this.loadComponentPanel(panel, component);
			}
		}
	}

	private save(): void {
		const saveData: HudLayout = {
			settings: { gridSize: this.gridSize },
			components: {}
		};

		for (const [id, component] of Object.entries(this.components)) {
			const posX = fixFloatingImprecision(
				LayoutUtil.getX(component.panel) +
					LayoutUtil.getWidth(component.panel) * SNAPS[Axis.X][component.snaps[Axis.X]].sizeFactor
			);
			const posY = fixFloatingImprecision(
				LayoutUtil.getY(component.panel) +
					LayoutUtil.getHeight(component.panel) * SNAPS[Axis.Y][component.snaps[Axis.Y]].sizeFactor
			);
			const size = LayoutUtil.getSize(component.panel);
			saveData.components[id] = {
				position: [posX, posY],
				size,
				snaps: component.snaps
			};
		}

		this.panels.customizer.saveLayout(saveData);
	}

	private loadComponentPanel(
		panel: GenericPanel,
		component: Pick<Component, 'position' | 'size' | 'snaps'>
	): Component {
		for (const [i, snap] of component.snaps.entries()) {
			if (!Enum.values(SnapMode).includes(snap)) {
				$.Warning(`HudCustomizer: Invalid snap values ${snap}, setting to default.`);
				component.snaps[i] = DEFAULT_SNAP_MODES[i];
			}
		}

		const layoutPos = component.position.map((len, axis) => {
			if (Number.isNaN(len)) {
				$.Warning(`HudCustomizer: Loaded invalid position ${len} for axis ${Axis[Axes[axis]]}, setting to 0.`);
				len = 0;
			}

			const isX = axis === 0;
			const max = isX ? MAX_X_POS : MAX_Y_POS;
			const sf = SNAPS[axis][component.snaps[axis]].sizeFactor;
			const panelLen = component.size[axis];
			let layoutLen = len - panelLen * sf;

			if (layoutLen < 0 && layoutLen + panelLen < MAX_OOB) {
				$.Warning(
					`HudCustomizer: Panel ${panel.id} is too far off-screen (X = ${layoutLen}), nudging on-screen.`
				);
				layoutLen = 0;
			} else if (layoutLen + panelLen > max - MAX_OOB) {
				$.Warning(
					`HudCustomizer: Panel ${panel.id} is too far off-screen (Y = ${layoutLen}), nudging on-screen.`
				);
				layoutLen = max - panelLen;
			}

			return layoutLen;
		}) as LayoutUtil.Position;

		LayoutUtil.setPositionAndSize(panel, layoutPos, component.size);

		return { panel, ...component };
	}

	private getCustomizablePanels() {
		return this.panels.hudRoot
			.Children()
			.filter((panel) => panel.GetAttributeString('customizable', 'false') === 'true');
	}

	private getDefaultComponent(panel: GenericPanel): Component | undefined {
		// Load and cache defaults
		this.defaultLayout ??= this.panels.customizer.getDefaultLayout();

		const defaults = this.defaultLayout.components[panel.id];
		if (!defaults || !Array.isArray(defaults.position) || !Array.isArray(defaults.size)) {
			// TODO: Should probably make this an error when proejct is completed, too annoying to do rn.
			$.Warning(
				`HudCustomizer: Found a customizable HUD element ${panel.paneltype} that doesn't have a default layout!`
			);

			return {
				panel,
				position: LayoutUtil.getPosition(panel),
				size: LayoutUtil.getSize(panel),
				snaps: DEFAULT_SNAP_MODES
			};
		}

		return { panel, ...defaults };
	}

	private onComponentMouseOver(component: Component): void {
		if (this.activeComponent && this.activeComponent === component) return;

		// TODO: Can probably apply all this kind of stylign to the overlay, not the underlying component panel.
		this.activeComponent?.panel.RemoveClass('hud-customizable--active');

		this.activeComponent = component;

		this.activeComponent.panel.AddClass('hud-customizable--active');

		const [position, size] = LayoutUtil.getPositionAndSize(component.panel);

		// Set the virtual panel's position and size to the component we just hovered over
		// TODO:conditional styling based on if top bit is too close to top of screen
		LayoutUtil.setPositionAndSize(this.panels.overlay, position, size);
		LayoutUtil.setPositionAndSize(this.panels.dragPanel, position, size);

		this.updateResizeKnobs(position, size);

		// This is going to be weird to localise, but I guess we could do it, probably in V2 when we can
		// define the locale string in the `customisable` XML property.
		this.panels.activeName.text = this.activeComponent.panel.id;

		SNAPS[Axis.X][this.activeComponent.snaps[Axis.X]].button.SetSelected(true);
		SNAPS[Axis.Y][this.activeComponent.snaps[Axis.Y]].button.SetSelected(true);

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.dragPanel, this.dragStartHandle);
		}
		if (this.dragEndHandle) {
			$.UnregisterEventHandler('DragEnd', this.panels.dragPanel, this.dragEndHandle);
		}

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.dragPanel, (...args) =>
			this.onStartDrag(DragMode.MOVE, this.panels.dragPanel, ...args)
		);
		this.dragEndHandle = $.RegisterEventHandler('DragEnd', this.panels.dragPanel, () => this.onEndDrag());
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

		const panelPos = this.activeComponent.position;
		const panelSize = this.activeComponent.size;

		// Resizing
		if (this.dragMode !== DragMode.MOVE) {
			const minSize = getMinSize(this.activeComponent.panel);
			const resizeDir = RESIZE_VECTOR[this.dragMode] ?? [0, 0];
			// TODO
			const knobPos = [0, 0]; //LayoutUtil.getPosition(this.panels.virtualKnob);

			for (const i of Axes) {
				if (resizeDir[i] === 1) {
					panelSize[i] = Math.max(knobPos[i] - panelPos[i], minSize[i]);
				} else if (resizeDir[i] === -1) {
					panelSize[i] += panelPos[i] - knobPos[i];
					const offset = Math.max(panelSize[i], minSize[i]) - panelSize[i];
					panelSize[i] += offset;
					panelPos[i] = knobPos[i] - offset;
				}
			}

			// LayoutUtil.setPositionAndSize(this.panels.virtual, panelPos, panelSize);
		}

		// Snapping
		if (this.dragMode === DragMode.MOVE) {
			for (const axis of Axes) {
				if (this.activeComponent.snaps[axis] === SnapMode.OFF) {
					continue;
				}

				this.handleMoveSnapping(axis);
			}
		}

		// TODO: move to class, use get/setters?
		this.activeComponent.position = panelPos;
		this.activeComponent.size = panelSize;
		LayoutUtil.setPositionAndSize(
			this.activeComponent.panel,
			this.activeComponent.position,
			this.activeComponent.size
		);

		LayoutUtil.setPositionAndSize(this.panels.overlay, panelPos, panelSize);

		this.updateResizeKnobs(panelPos, panelSize);
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

	private updateResizeKnobs(position: LayoutUtil.Position, size: LayoutUtil.Size): void {
		const [width, height] = size;
		const halfWidth = width / 2;
		const halfHeight = height / 2;
		let deltaX: number, deltaY: number;

		for (const [dir, knob] of Object.entries(this.resizeKnobs)) {
			switch (+dir) {
				case DragMode.RESIZE_TOP:
					deltaX = halfWidth;
					deltaY = 0;
					break;
				case DragMode.RESIZE_TOP_RIGHT:
					deltaX = width;
					deltaY = 0;
					break;
				case DragMode.RESIZE_RIGHT:
					deltaX = width;
					deltaY = halfHeight;
					break;
				case DragMode.RESIZE_BOTTOM_RIGHT:
					deltaX = width;
					deltaY = height;
					break;
				case DragMode.RESIZE_BOTTOM:
					deltaX = halfWidth;
					deltaY = height;
					break;
				case DragMode.RESIZE_BOTTOM_LEFT:
					deltaX = 0;
					deltaY = height;
					break;
				case DragMode.RESIZE_LEFT:
					deltaX = 0;
					deltaY = halfHeight;
					break;
				case DragMode.RESIZE_TOP_LEFT:
				default:
					deltaX = 0;
					deltaY = 0;
					break;
			}

			const [x, y] = position;
			LayoutUtil.setPosition(knob, [x + deltaX, y + deltaY]);
		}
	}

	private handleMoveSnapping(axis: Axis): void {
		if (!this.activeComponent) return;

		const snapStrength = 0.2;

		const gridGapLength =
			axis === Axis.X ? MAX_X_POS / this.gridlines[axis].length : MAX_Y_POS / this.gridlines[axis].length;

		// If left or right are within snapStrength * gridGapLength of a gridline, snap to it
		// If both left and right are within snap range, snap to the closest one
		const panelPos = LayoutUtil.getPosition(this.panels.dragPanel)[axis];
		const panelSize = LayoutUtil.getSize(this.panels.dragPanel)[axis];

		let leftIndex: number | undefined;
		for (let i = 0; i < this.gridlines[axis].length; i++) {
			const gl = this.gridlines[axis][i];
			if (Math.abs(gl.offset - panelPos) <= snapStrength * gridGapLength) {
				leftIndex = i;
				break;
			}
		}

		let rightIndex: number | undefined;
		const panelRightPos = panelPos + panelSize;
		for (let i = 0; i < this.gridlines[axis].length; i++) {
			const gl = this.gridlines[axis][i];
			if (Math.abs(gl.offset - panelRightPos) <= snapStrength * gridGapLength) {
				rightIndex = i;
				break;
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
			return;
		}

		if (leftIndex !== undefined) {
			this.activeComponent.position[axis] = this.gridlines[axis][leftIndex].offset;
			this.setActiveGridline(axis, this.gridlines[axis][leftIndex]);
		} else {
			this.activeComponent.position[axis] = this.gridlines[axis][rightIndex!].offset - panelSize;
			this.setActiveGridline(axis, this.gridlines[axis][rightIndex!]);
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

				let cssClass = `hud-customizer-grid__gridline hud-customizer-grid__line--${isX ? 'x' : 'y'}`;
				if (i === numLines / 2) cssClass += ' hud-customizer-grid__line--mid';
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

	public updateGridSize(): void {
		const newSize = this.panels.gridSize.value;

		if (newSize !== this.gridSize) {
			this.gridSize = newSize;
			this.createGridLines();
		}
	}

	public setSnapMode(axis: keyof Axis, mode: SnapMode): void {
		if (!this.activeComponent) return;

		this.activeComponent.snaps[axis] = mode;
		this.showSnapTooltip();
	}

	public showSnapTooltip(): void {
		if (!this.activeComponent) return;
		UiToolkitAPI.ShowTextTooltip(
			this.panels.activeSnaps.id,
			'<b><i>Snapping Mode</i></b>\n' +
				`Horizontal: <b>${SNAPS[Axis.X][this.activeComponent.snaps[Axis.X]].name}</b>\n` +
				`Vertical: <b>${SNAPS[Axis.Y][this.activeComponent.snaps[Axis.Y]].name}</b>`
		);
	}

	public hideSnapTooltip(): void {
		UiToolkitAPI.HideTextTooltip();
	}
}

function fixFloatingImprecision(n: number) {
	return +n.toPrecision(3);
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
