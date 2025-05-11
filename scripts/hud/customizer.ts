import { values } from 'util/enum';
import { PanelHandler, OnPanelLoad } from 'util/module-helpers';
import * as LayoutUtil from 'common/layout';

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

enum ResizeDirection {
	TOP = 1,
	TOP_RIGHT = 2,
	RIGHT = 3,
	BOTTOM_RIGHT = 4,
	BOTTOM = 5,
	BOTTOM_LEFT = 6,
	LEFT = 7,
	TOP_LEFT = 8
}

const MAX_X_POS = 1920;
const MAX_Y_POS = 1080;
const MAX_OOB = 16;

interface HudConfig {
	components: {
		[id: string]: {
			position: LayoutUtil.Position;
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
	properties?: Record<string, unknown>;
}

interface Gridline {
	panel: Panel;
	offset: number;
}

type GridlineForAxis = [Gridline[], Gridline[]];

const snaps: Record<
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
		snaps: $('#HudCustomizerSnaps')!,
		grid: $('#HudCustomizerGrid')!,
		gridSize: $<NumberEntry>('#HudCustomizerGridSize')!,
		knobContainer: $('#HudCustomizerKnobContainer')!
	};

	private components: Record<string, Component> = {};
	private gridlines: GridlineForAxis = [[], []];
	private activeComponent: Component | undefined;
	private activeGridlines: [Gridline | undefined, Gridline | undefined] = [undefined, undefined];
	private resizeKnobs: Record<ResizeDirection, Button>;
	private dragStartHandle: number | undefined;
	private dragEndHandle: number | undefined;
	private onThinkHandle: number | undefined;
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
					LayoutUtil.getWidth(component.panel) * snaps[Axis.X][component.snaps[Axis.X]].sizeFactor
			);
			const posY = fixFloatingImprecision(
				LayoutUtil.getY(component.panel) +
					LayoutUtil.getHeight(component.panel) * snaps[Axis.Y][component.snaps[Axis.Y]].sizeFactor
			);
			saveData.components[id] = {
				position: [posX, posY],
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

		this.resizeKnobs = {} as any;
		for (const dir of values(ResizeDirection).filter((x) => !Number.isNaN(+x))) {
			this.resizeKnobs[dir] = $.CreatePanel(
				'Button',
				this.panels.knobContainer,
				`Resize_${ResizeDirection[dir]}`,
				{
					class: 'hud-customizer__resize-knob',
					draggable: true,
					hittest: true
				}
			);
		}

		this.components = {};
		for (const panel of this.getCustomizablePanels()) {
			this.loadComponentPanel(panel, layoutData?.components?.[panel.id] ?? this.getDefaultComponent(panel));
		}
	}

	private loadComponentPanel(panel: GenericPanel, component: Pick<Component, 'position' | 'snaps'>): void {
		for (const [i, snap] of component.snaps.entries()) {
			if (!values(SnapMode).includes(snap)) {
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
			const sf = snaps[axis][component.snaps[axis]].sizeFactor;
			const panelLen = isX ? LayoutUtil.getWidth(panel) : LayoutUtil.getHeight(panel);
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

		LayoutUtil.setPosition(panel, layoutPos);

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
		if (
			size[0] > MAX_X_POS ||
			size[1] > MAX_Y_POS ||
			(size[0] === MAX_X_POS && size[1] > MAX_Y_POS / 2) ||
			(size[1] === MAX_X_POS && size[0] > MAX_X_POS / 2)
		) {
			$.Warning(
				`HudCustomizer: Found an unrecognised HUD panel ${panel.paneltype} with stupid big dimensions, ignoring.\n` +
					`\tWidth: ${size[0]}\tHeight: ${size[1]}` +
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
			snaps: DEFAULT_SNAP_MODES
		};
	}

	private onComponentMouseOver(component: Component): void {
		if (this.activeComponent && this.activeComponent === component) return;

		this.activeComponent?.panel.RemoveClass('hud-customizable--active');

		this.activeComponent = component;

		this.activeComponent.panel.AddClass('hud-customizable--active');

		const [[x, y], [width, height]] = LayoutUtil.getPositionAndSize(component.panel);

		// Set the virtual panel's position and size to the component we just hovered over
		LayoutUtil.setPositionAndSize(this.panels.virtual, [x, y], [width, height]);
		LayoutUtil.setPositionAndSize(this.panels.knobContainer, [x, y], [width, height]);

		const halfWidth = width / 2;
		const halfHeight = height / 2;
		let plusX: number, plusY: number;
		for (const [dir, knob] of Object.entries(
			this.resizeKnobs satisfies Record<ResizeDirection, Button>
		) as unknown as [ResizeDirection, Button][]) {
			switch (+dir) {
				case ResizeDirection.TOP:
					plusX = halfWidth;
					plusY = 0;
					break;
				case ResizeDirection.TOP_RIGHT:
					plusX = width;
					plusY = 0;
					break;
				case ResizeDirection.RIGHT:
					plusX = width;
					plusY = halfHeight;
					break;
				case ResizeDirection.BOTTOM_RIGHT:
					plusX = width;
					plusY = height;
					break;
				case ResizeDirection.BOTTOM:
					plusX = halfWidth;
					plusY = height;
					break;
				case ResizeDirection.BOTTOM_LEFT:
					plusX = 0;
					plusY = height;
					break;
				case ResizeDirection.LEFT:
					plusX = 0;
					plusY = halfHeight;
					break;
				case ResizeDirection.TOP_LEFT:
					plusX = 0;
					plusY = 0;
					break;
			}

			$.Msg('HudCustomizer: setting resize knob', { x, y, width, height, dir, plusX, plusY });

			LayoutUtil.setPosition(knob, [plusX, plusY]);
		}

		// This is going to be weird to localise, but I guess we could do it, probably in V2 when we can
		// define the locale string in the `customisable` XML property.
		this.panels.virtualName.text = this.activeComponent.panel.id;
		// TODO: This text looks TERRIBLE. Better to just have a constant size text for every component
		// place text above component (left-aligned)
		const stupidFontSizeThing = Math.min(
			LayoutUtil.getHeight(this.activeComponent.panel) / 2,
			LayoutUtil.getWidth(this.activeComponent.panel) / 2
		);

		this.panels.virtualName.style.fontSize = stupidFontSizeThing;

		snaps[Axis.X][this.activeComponent.snaps[Axis.X]].button.SetSelected(true);
		snaps[Axis.Y][this.activeComponent.snaps[Axis.Y]].button.SetSelected(true);

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);
		}

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, (...args) =>
			this.onStartDrag(...args)
		);
	}

	private onStartDrag(_panelID: string, callback: DragEventInfo): void {
		if (!this.activeComponent) return;

		callback.displayPanel = this.panels.virtual;
		callback.removePositionBeforeDrop = false;

		// These aren't actually related to one-another in XML hierarchy so need to handle two classes
		this.activeComponent.panel.AddClass('hud-customizable--dragging');
		this.panels.virtual.AddClass('hud-customizer-virtual--dragging');

		$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);

		this.onThinkHandle = $.RegisterEventHandler('HudThink', $.GetContextPanel(), () => this.onDragThink());

		this.dragEndHandle = $.RegisterEventHandler('DragEnd', this.panels.virtual, () => this.onEndDrag());
	}

	private onDragThink(): void {
		if (!this.activeComponent) return;

		const oldPosition = [0, 0];
		const newPosition: LayoutUtil.Position = [0, 0];

		for (const axis of Axes) {
			const isX = axis === 0;

			if (this.activeComponent.snaps[axis] === SnapMode.OFF) {
				newPosition[axis] = isX ? LayoutUtil.getX(this.panels.virtual) : LayoutUtil.getY(this.panels.virtual);
			} else {
				const sizeFactor = snaps[axis][this.activeComponent.snaps[axis]].sizeFactor;

				const offset = isX
					? (this.activeComponent.panel.actuallayoutwidth * sizeFactor) / this.scaleX
					: (this.activeComponent.panel.actuallayoutheight * sizeFactor) / this.scaleY;

				const gridline = this.getNearestGridLine(axis, sizeFactor);
				const activeGridline = this.activeGridlines[axis];

				if (activeGridline) oldPosition[axis] = activeGridline.offset - offset;
				if (gridline) newPosition[axis] = gridline.offset - offset;

				if (gridline !== activeGridline) {
					if (activeGridline) activeGridline.panel.RemoveClass('hud-customizer__gridline--highlight');
					if (gridline) {
						gridline.panel.AddClass('hud-customizer__gridline--highlight');
						this.activeGridlines[axis] = gridline;

						newPosition[axis] = gridline.offset - offset;
					}
				}
			}
		}

		if (newPosition[0] !== oldPosition[1] || newPosition[1] !== oldPosition[1]) {
			LayoutUtil.setPosition(this.activeComponent.panel, newPosition);
			LayoutUtil.setPosition(this.panels.knobContainer, newPosition);
		}
	}

	private onEndDrag(): void {
		if (!this.activeComponent) return;

		$.UnregisterEventHandler('DragEnd', this.panels.virtual, this.dragEndHandle);
		$.UnregisterEventHandler('HudThink', $.GetContextPanel(), this.onThinkHandle);

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, (...args) =>
			this.onStartDrag(...args)
		);
		this.dragEndHandle = undefined;
		this.onThinkHandle = undefined;

		this.activeComponent.panel.RemoveClass('hud-customizable--dragging');
		this.panels.virtual.RemoveClass('hud-customizer-virtual--dragging');

		LayoutUtil.copyPositionAndSize(this.activeComponent.panel, this.panels.virtual);

		this.activeGridlines?.forEach((line) => line.panel.RemoveClass('hud-customizer__gridline--highlight'));

		this.activeGridlines = [undefined, undefined];

		// TODO: this is just for testing
		this.save();
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
				`Horizontal: <b>${snaps[Axis.X][this.activeComponent.snaps[Axis.X]].name}</b>\n` +
				`Vertical: <b>${snaps[Axis.Y][this.activeComponent.snaps[Axis.Y]].name}</b>`
		);
	}

	public hideSnapTooltip(): void {
		UiToolkitAPI.HideTextTooltip();
	}
}

function fixFloatingImprecision(n: number) {
	return +n.toPrecision(3);
}
