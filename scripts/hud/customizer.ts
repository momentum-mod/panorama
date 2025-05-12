import * as LayoutUtil from 'common/layout';
import * as Enum from 'util/enum';
import { PanelHandler, OnPanelLoad } from 'util/module-helpers';

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

const resizeVector: Record<ResizeMode, [number, number]> = {
	[DragMode.RESIZE_TOP]: [0, -1],
	[DragMode.RESIZE_TOP_RIGHT]: [1, -1],
	[DragMode.RESIZE_RIGHT]: [1, 0],
	[DragMode.RESIZE_BOTTOM_RIGHT]: [1, 1],
	[DragMode.RESIZE_BOTTOM]: [0, 1],
	[DragMode.RESIZE_BOTTOM_LEFT]: [-1, 1],
	[DragMode.RESIZE_LEFT]: [-1, 0],
	[DragMode.RESIZE_TOP_LEFT]: [1, -1]
} satisfies Record<ResizeMode, [number, number]> as any;

const MAX_X_POS = 1920;
const MAX_Y_POS = 1080;
const MAX_OOB = 16;

interface HudConfig {
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

const DEFAULT_GRID_SIZE = 5;

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

const SNAPS: Record<
	Axis,
	Record<
		SnapMode,
		{
			name: string;
			button: RadioButton;
			sizeFactor: number;
		}
	>
> = {
	[Axis.X]: {
		[SnapMode.MIN]: {
			name: 'Left',
			button: $<RadioButton>('#HudCustomizerSnapsXMin')!,
			sizeFactor: 0
		},
		[SnapMode.MID]: {
			name: 'Center',
			button: $<RadioButton>('#HudCustomizerSnapsXMid')!,
			sizeFactor: 0.5
		},
		[SnapMode.MAX]: {
			name: 'Right',
			button: $<RadioButton>('#HudCustomizerSnapsXMax')!,
			sizeFactor: 1
		},
		[SnapMode.OFF]: {
			name: 'None',
			button: $<RadioButton>('#HudCustomizerSnapsXOff')!,
			sizeFactor: 0
		}
	},
	[Axis.Y]: {
		[SnapMode.MIN]: {
			name: 'Top',
			button: $<RadioButton>('#HudCustomizerSnapsYMin')!,
			sizeFactor: 0
		},
		[SnapMode.MID]: {
			name: 'Center',
			button: $<RadioButton>('#HudCustomizerSnapsYMid')!,
			sizeFactor: 0.5
		},
		[SnapMode.MAX]: {
			name: 'Bottom',
			button: $<RadioButton>('#HudCustomizerSnapsYMax')!,
			sizeFactor: 1
		},
		[SnapMode.OFF]: {
			name: 'None',
			button: $<RadioButton>('#HudCustomizerSnapsYOff')!,
			sizeFactor: 0
		}
	}
};

@PanelHandler()
class HudCustomizer implements OnPanelLoad {
	readonly panels = {
		customizer: $('#HudCustomizer')!,
		virtual: $<Panel>('#HudCustomizerVirtual')!,
		virtualName: $<Label>('#HudCustomizerVirtualName')!,
		virtualKnob: $<Panel>('#HudCustomizerVirtualKnob')!,
		snaps: $('#HudCustomizerSnaps')!,
		grid: $('#HudCustomizerGrid')!,
		gridSize: $<NumberEntry>('#HudCustomizerGridSize')!
	};

	private components: Record<string, Component> = {};
	private gridlines: GridlineForAxis = [[], []];
	private activeComponent: Component | undefined;
	private activeGridlines: [Gridline | undefined, Gridline | undefined] = [undefined, undefined];

	// `${ResizeMode}` allows us to return correctly typed values from recordEntries and convert them explicitly back into ResizeMode
	private resizeKnobs: Record<`${ResizeMode}`, Button>;

	private dragStartHandle: number | undefined;
	private dragEndHandle: number | undefined;
	private onThinkHandle: number | undefined;

	private dragMode: DragMode | undefined;

	private gridSize = DEFAULT_GRID_SIZE;

	private scaleX: number;
	private scaleY: number;

	public onPanelLoad(): void {
		this.scaleX = $.GetContextPanel().actualuiscale_x;
		this.scaleY = $.GetContextPanel().actualuiscale_y;
		$.RegisterForUnhandledEvent('HudChat_Show', () => this.enableEditing());
		$.RegisterForUnhandledEvent('HudChat_Hide', () => this.disableEditing());
	}

	public enableEditing(): void {
		// Onload calls load() too early so have to do this
		// TODO: I don't know why the above is the case, clearly shitty behaviour, figure it out!

		if (!this.components || Object.keys(this.components).length === 0) {
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
		$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);
	}

	private save(): void {
		const saveData: HudConfig = {
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

		HudCustomizerAPI.SaveLayoutFromJS(saveData);
	}

	private load(): void {
		this.gridlines = [[], []];
		this.activeGridlines = [undefined, undefined];
		this.activeComponent = undefined;

		let layoutData: HudConfig;
		try {
			layoutData = HudCustomizerAPI.GetLayout() as HudConfig;
		} catch {
			$.Warning('HudCustomizer: Failed to parse layout file!');
			return;
		}

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
			$.RegisterEventHandler('DragStart', this.resizeKnobs[dir], (...args) =>
				this.onStartDrag(dir, this.panels.virtualKnob, ...args)
			);
			$.RegisterEventHandler('DragEnd', this.resizeKnobs[dir], () => this.onEndDrag());
		}

		this.components = {};
		for (const panel of this.getCustomizablePanels()) {
			this.loadComponentPanel(panel, layoutData?.components?.[panel.id] ?? this.getDefaultComponent(panel));
		}
	}

	private loadComponentPanel(panel: GenericPanel, component: Pick<Component, 'position' | 'size' | 'snaps'>): void {
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

		this.components[panel.id] = {
			panel,
			...component
		};
	}

	private getCustomizablePanels() {
		return $.GetContextPanel()
			.Children()
			.filter((panel) => panel.GetAttributeString('customizable', 'false') === 'true');
	}

	private getDefaultComponent(panel: GenericPanel): Component {
		const size = LayoutUtil.getSize(panel);
		const [width, height] = size;
		if (
			width > MAX_X_POS ||
			height > MAX_Y_POS ||
			(width === MAX_X_POS && height > MAX_Y_POS / 2) ||
			(height === MAX_X_POS && width > MAX_X_POS / 2)
		) {
			$.Warning(
				`HudCustomizer: Found an unrecognised HUD panel ${panel.paneltype} with stupid big dimensions, ignoring.\n` +
					`\tWidth: ${width}\tHeight: ${height}` +
					`\tPosition: [${LayoutUtil.getPosition(panel).join(', ')}]).`
			);
			return;
		}

		// TODO: This approach isn't right. If the component wasn't found in hud.kv3, it's probably a new HUD
		// component that was added after the user first launched then closed the game, generating hud.kv3 for the
		// first time. So use the new HudCustomizerAPI.GetDefaultLayout and see if a matching component is in there,
		// and if it is, use those values. Only if it's not found in there should we do the below stuff.

		$.Msg("HudCustomizer: Found a customizable HUD element that isn't stored, initialising with default values.");
		return {
			panel,
			position: LayoutUtil.getPosition(panel),
			size,
			snaps: DEFAULT_SNAP_MODES
		};
	}

	private onComponentMouseOver(component: Component): void {
		if (this.activeComponent && this.activeComponent === component) return;

		this.activeComponent?.panel.RemoveClass('hud-customizable--active');

		this.activeComponent = component;

		this.activeComponent.panel.AddClass('hud-customizable--active');

		const [position, size] = LayoutUtil.getPositionAndSize(component.panel);

		// Set the virtual panel's position and size to the component we just hovered over
		LayoutUtil.setPositionAndSize(this.panels.virtual, position, size);

		this.updateResizeKnobs(position, size);

		// This is going to be weird to localise, but I guess we could do it, probably in V2 when we can
		// define the locale string in the `customisable` XML property.
		this.panels.virtualName.text = this.activeComponent.panel.id;
		// TODO: This text looks TERRIBLE. Better to just have a constant size text for every component
		// place text above component (left-aligned)

		this.updateVirtualPanelFontSize();

		SNAPS[Axis.X][this.activeComponent.snaps[Axis.X]].button.SetSelected(true);
		SNAPS[Axis.Y][this.activeComponent.snaps[Axis.Y]].button.SetSelected(true);

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);
		}
		if (this.dragEndHandle) {
			$.UnregisterEventHandler('DragEnd', this.panels.virtual, this.dragEndHandle);
		}

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, (...args) =>
			this.onStartDrag(DragMode.MOVE, this.panels.virtual, ...args)
		);
		this.dragEndHandle = $.RegisterEventHandler('DragEnd', this.panels.virtual, () => this.onEndDrag());
	}

	private onStartDrag(mode: DragMode, displayPanel: Panel, _panelID: string, callback: DragEventInfo) {
		if (!this.activeComponent) return;

		this.dragMode = mode;

		this.onThinkHandle = $.RegisterEventHandler('HudThink', $.GetContextPanel(), () => this.onDragThink());

		if (this.dragMode !== DragMode.MOVE) {
			callback.offsetX = 0;
			callback.offsetY = 0;
		}

		callback.displayPanel = displayPanel;
		callback.removePositionBeforeDrop = false;
	}

	private onDragThink(): void {
		if (!this.activeComponent || this.dragMode === undefined) return;

		let panelPos = this.activeComponent.position;
		const panelSize = this.activeComponent.size;

		const minSize = getMinSize(this.activeComponent.panel);

		if (this.dragMode === DragMode.MOVE) {
			panelPos = LayoutUtil.getPosition(this.panels.virtual);
		} else {
			const resizeDir = resizeVector[this.dragMode] ?? [0, 0];
			const knobPos = LayoutUtil.getPosition(this.panels.virtualKnob);
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
		}

		this.updateVirtualPanelFontSize();

		LayoutUtil.setPositionAndSize(this.panels.virtual, panelPos, panelSize);

		// snapping
		if (this.dragMode === DragMode.MOVE) {
			for (const axis of Axes) {
				const isX = axis === 0;

				if (this.activeComponent.snaps[axis] !== SnapMode.OFF) {
					const sizeFactor = SNAPS[axis][this.activeComponent.snaps[axis]].sizeFactor;

					const offset = panelSize[axis] * sizeFactor;

					const gridline = this.getNearestGridLine(axis, sizeFactor);
					const activeGridline = this.activeGridlines[axis];

					if (gridline) panelPos[axis] = gridline.offset - offset;
					if (gridline !== activeGridline) {
						if (activeGridline) activeGridline.panel.RemoveClass('hud-customizer__gridline--highlight');
						if (gridline) {
							gridline.panel.AddClass('hud-customizer__gridline--highlight');
							this.activeGridlines[axis] = gridline;
						}
					}
				}
			}
		}

		this.activeComponent.position = panelPos;
		this.activeComponent.size = panelSize;
		LayoutUtil.setPositionAndSize(
			this.activeComponent.panel,
			this.activeComponent.position,
			this.activeComponent.size
		);
		this.updateResizeKnobs(panelPos, panelSize);
	}

	private onEndDrag() {
		if (!this.activeComponent) return;

		this.onDragThink(); // call the last think to ensure the final position is set

		$.UnregisterEventHandler('HudThink', $.GetContextPanel(), this.onThinkHandle);

		LayoutUtil.setPositionAndSize(this.panels.virtual, this.activeComponent.position, this.activeComponent.size);

		this.activeComponent.panel.RemoveClass('hud-customizable--dragging');
		this.panels.virtual.RemoveClass('hud-customizer-virtual--dragging');

		this.activeGridlines?.forEach((line) => line?.panel.RemoveClass('hud-customizer__gridline--highlight'));
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

		for (const [dir, knob] of recordEntries(this.resizeKnobs)) {
			switch (+(dir satisfies `${ResizeMode}`) as ResizeMode) {
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
					deltaX = 0;
					deltaY = 0;
					break;
			}

			const [x, y] = position;
			LayoutUtil.setPosition(knob, [x + deltaX, y + deltaY]);
		}
	}

	private updateVirtualPanelFontSize() {
		if (!this.activeComponent) return;
		const [width, height] = this.activeComponent.size;
		const stupidFontSizeThing = Math.min(width / 2, height / 2);

		this.panels.virtualName.style.fontSize = stupidFontSizeThing;
	}

	private getNearestGridLine(axis: Axis, sizeFactor: number): Gridline {
		const isX = axis === Axis.X;
		const relativeOffset = isX
			? Math.max(
					0,
					Math.min(
						MAX_X_POS,
						(this.panels.virtual.actualxoffset + this.panels.virtual.actuallayoutwidth * sizeFactor) /
							this.scaleX
					)
				)
			: Math.max(
					0,
					Math.min(
						MAX_Y_POS,
						(this.panels.virtual.actualyoffset + this.panels.virtual.actuallayoutheight * sizeFactor) /
							this.scaleY
					)
				);
		const glIndex = Math.round((relativeOffset / (isX ? MAX_X_POS : MAX_Y_POS)) * this.gridlines[axis].length);
		return this.gridlines[axis][glIndex];
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

				let cssClass = `hud-customizer__gridline hud-customizer__gridline--${isX ? 'x' : 'y'}`;
				if (i === numLines / 2) cssClass += ' hud-customizer__gridline--mid';
				if (i === 0 || i === numLines) cssClass += 'hud-customizer__gridline--edge';

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
			this.panels.snaps.id,
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

function recordEntries<K extends keyof any, T>(record: Record<K, T>): [K, T][] {
	return Object.entries(record) as [K, T][];
}
