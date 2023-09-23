/// <reference path="../common/layout.ts" />

// Code is simplest and cheapest if just treat X, Y axis as 0, 1 so we can use as indices.
const Axes = [0, 1] as const;
type AxisType = 0 | 1;

/**
 * The four different snapping behaviours
 * For a horizontal panel, min and max are left and right respectively, for vertical, top and bottom
 */
enum SnapMode {
	MIN = 1,
	MID = 2,
	MAX = 3,
	OFF = 4
}

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

// Tuple of X, Y axis snaps respectively
const DEFAULT_SNAP_MODES: Snaps = [SnapMode.OFF, SnapMode.OFF];
const DEFAULT_GRID_SIZE = 5;

interface Component {
	panel: Panel;
	snaps: Snaps;
	position: Position;
	properties?: Record<string, unknown>;
}

interface Gridline {
	panel: Panel;
	offset: number;
}

type GridlineForAxis = [Gridline[], Gridline[]];

class HudCustomizer {
	static snaps: Record<AxisType, Record<SnapMode, { name: string; button: RadioButton; sizeFactor: number }>> = {
		0: {
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
		1: {
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

	static panels = {
		customizer: $('#HudCustomizer')!,
		virtual: $('#HudCustomizerVirtual')!,
		virtualName: $<Label>('#HudCustomizerVirtualName')!,
		snaps: $('#HudCustomizerSnaps')!,
		grid: $('#HudCustomizerGrid')!,
		gridSize: $<NumberEntry>('#HudCustomizerGridSize')!,
		knobContainer: $('#HudCustomizerKnobContainer')!
	};

	static components: Record<string, Component>;
	static gridlines: GridlineForAxis;
	static activeComponent?: Component;
	static activeGridlines: [Gridline | undefined, Gridline | undefined];
	static resizeKnobs: Record<ResizeDirection, Button>;

	static dragStartHandle?: number;
	static dragEndHandle?: number;
	static onThinkHandle?: number;

	static knobDragStartHandle?: number;
	static knobDragEndHandle?: number;
	static knobOnThinkHandle?: number;

	static gridSize = 5;

	static scaleX = $.GetContextPanel().actualuiscale_x;
	static scaleY = $.GetContextPanel().actualuiscale_y;

	static {
		$.RegisterForUnhandledEvent('HudChat_Show', this.enableEditing.bind(this));
		$.RegisterForUnhandledEvent('HudChat_Hide', this.disableEditing.bind(this));

		this.resizeKnobs = {} as any;
		for (const dir of Object.values(ResizeDirection).filter((x) => !Number.isNaN(+x)) as ResizeDirection[]) {
			const knob = $.CreatePanel('Button', this.panels.knobContainer, `Resize_${ResizeDirection[dir]}`, {
				class: 'hud-customizer__resize-knob',
				draggable: true,
				hittest: true
			});

			this.resizeKnobs[dir] = knob;
		}
	}

	static save() {
		const saveData: HudLayoutData = {
			settings: { gridSize: this.gridSize },
			components: {}
		};

		for (const [id, component] of Object.entries(this.components)) {
			const posX = this.fixFloatingImprecision(
				LayoutUtil.getX(component.panel) +
					LayoutUtil.getWidth(component.panel) * this.snaps[0][component.snaps[0]].sizeFactor
			);
			const posY = this.fixFloatingImprecision(
				LayoutUtil.getX(component.panel) +
					LayoutUtil.getHeight(component.panel) * this.snaps[1][component.snaps[1]].sizeFactor
			);

			saveData.components[id] = {
				position: [posX, posY],
				snaps: component.snaps
			};
		}

		HudCustomizerAPI.SaveLayoutFromJS(saveData);
	}

	static load() {
		this.gridlines = [[], []];
		this.activeGridlines = [undefined, undefined];
		this.activeComponent = undefined;

		let layoutData: HudLayoutData;
		try {
			layoutData = HudCustomizerAPI.GetLayout();
		} catch {
			$.Warning('HudCustomizer: Failed to parse layout file!');
			return;
		}

		this.gridSize = layoutData?.settings?.gridSize ?? 5;
		this.panels.gridSize.value = this.gridSize;

		this.createGridLines();

		this.components = {};
		$.GetContextPanel()
			.Children()
			.filter((panel) => panel.GetAttributeString('customizable', '') === 'true')
			.forEach((panel) => this.loadComponentPanel(layoutData?.components[panel.id], panel));
	}

	static loadComponentPanel(component: Pick<Component, 'position' | 'snaps'> | undefined, panel: Panel) {
		if (component) {
			const snaps = component.snaps;
			for (const [i, snap] of snaps.entries()) {
				if (!Object.values(SnapMode).includes(snap)) {
					$.Warning(`HudCustomizer: Invalid snap values ${snap}, setting to default.`);
					snaps[i] = DEFAULT_SNAP_MODES[i];
				}
			}

			const layoutPos = component.position.map((len, i) => {
				if (Number.isNaN(len)) {
					$.Warning(`HudCustomizer: Loaded invalid position ${len}, setting to 0.`);
					len = 0;
				}

				const isX = i === 0;
				const max = isX ? 1920 : 1080;
				const sf = this.snaps[i][snaps[i]].sizeFactor;
				const panelLen = isX ? LayoutUtil.getWidth(panel) : LayoutUtil.getHeight(panel);
				let layoutLen = len - panelLen * sf;
				const maxOOB = 16;

				if (layoutLen < 0 && layoutLen + panelLen < maxOOB) {
					$.Warning(
						`HudCustomizer: Panel ${panel.id} is too far off-screen (X = ${layoutLen}), nudging on-screen.`
					);
					layoutLen = 0;
				} else if (layoutLen + panelLen > max - maxOOB) {
					$.Warning(
						`HudCustomizer: Panel ${panel.id} is too far off-screen (Y = ${layoutLen}), nudging on-screen.`
					);
					layoutLen = max - panelLen;
				}

				return layoutLen;
			}) as Position;

			LayoutUtil.setPosition(panel, layoutPos);

			this.components[panel.id] = {
				panel,
				...component
			};
		} else {
			const size = LayoutUtil.getSize(panel);

			if (
				size[0] > 1920 ||
				size[1] > 1080 ||
				(size[0] === 1920 && size[1] > 1080 / 2) ||
				(size[1] === 1080 && size[0] > 1920 / 2)
			) {
				$.Warning(
					`HudCustomizer: Found an unrecognised HUD panel ${panel.paneltype} with stupid big dimensions, ignoring.\n` +
						`\tWidth: ${size[0]}\tHeight: ${size[1]}` +
						`\tPosition: [${LayoutUtil.getPosition(panel).join(', ')}]).`
				);
				return;
			}

			$.Msg(
				"HudCustomizer: Found a customizable HUD element that isn't stored, initialising with default values."
			);

			this.components[panel.id] = {
				panel,
				position: LayoutUtil.getPosition(panel),
				snaps: DEFAULT_SNAP_MODES
			};
		}
	}

	static enableEditing() {
		// Onload calls load() too early so have to do this
		if (!this.components || Object.keys(this.components).length === 0) this.load();

		this.panels.customizer.AddClass('hud-customizer--enabled');

		for (const component of Object.values(this.components)) {
			component.panel.AddClass('hud-customizable');
			component.panel.SetPanelEvent('onmouseover', this.onComponentMouseOver.bind(this, component));
		}
	}

	static disableEditing() {
		this.panels.customizer.RemoveClass('hud-customizer--enabled');

		for (const component of Object.values(this.components)) {
			component.panel.RemoveClass('hud-customizable');
			component.panel.ClearPanelEvent('onmouseover');
		}

		$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);
	}

	static onComponentMouseOver(component: Component) {
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
		let plusX, plusY;
		for (const [dir, knob] of Object.entries(this.resizeKnobs)) {
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

			$.Msg({ x, y, width, height, dir, plusX, plusY });

			LayoutUtil.setPosition(knob, [plusX, plusY]);
		}

		// This is going to be weird to localise, but I guess we could do it, probably in V2 when we can
		// define the locale string in the `customisable` XML property.
		this.panels.virtualName.text = this.activeComponent.panel.id;
		const stupidFontSizeThing = Math.min(
			LayoutUtil.getHeight(this.activeComponent.panel) / 2,
			LayoutUtil.getWidth(this.activeComponent.panel) / 2
		);

		this.panels.virtualName.style.fontSize = stupidFontSizeThing;

		this.snaps[0][this.activeComponent.snaps[0]].button.SetSelected(true);
		this.snaps[1][this.activeComponent.snaps[1]].button.SetSelected(true);

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);
		}

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, this.onStartDrag.bind(this));
	}

	static onStartDrag(_source, callback) {
		if (!this.activeComponent) return;

		callback.displayPanel = this.panels.virtual;
		callback.removePositionBeforeDrop = false;

		// These aren't actually related to one-another in XML hierarchy so need to handle two classes
		this.activeComponent.panel.AddClass('hud-customizable--dragging');
		this.panels.virtual.AddClass('hud-customizer-virtual--dragging');

		$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);

		this.onThinkHandle = $.RegisterEventHandler('ChaosHudThink', $.GetContextPanel(), this.onDragThink.bind(this));

		this.dragEndHandle = $.RegisterEventHandler('DragEnd', this.panels.virtual, this.onEndDrag.bind(this));
	}

	static onDragThink() {
		if (!this.activeComponent) return;

		const oldPosition = [0, 0];
		const newPosition: Position = [0, 0];

		for (const axis of Axes) {
			const isX = axis === 0;

			if (this.activeComponent.snaps[axis] === SnapMode.OFF) {
				newPosition[axis] = isX ? LayoutUtil.getX(this.panels.virtual) : LayoutUtil.getY(this.panels.virtual);
			} else {
				const sizeFactor = this.snaps[axis][this.activeComponent.snaps[axis]].sizeFactor;

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

	static onEndDrag() {
		if (!this.activeComponent) return;

		$.UnregisterEventHandler('DragEnd', this.panels.virtual, this.dragEndHandle);
		$.UnregisterEventHandler('ChaosHudThink', $.GetContextPanel(), this.onThinkHandle);

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, this.onStartDrag.bind(this));

		this.dragEndHandle = undefined;
		this.onThinkHandle = undefined;

		this.activeComponent.panel.RemoveClass('hud-customizable--dragging');
		this.panels.virtual.RemoveClass('hud-customizer-virtual--dragging');

		LayoutUtil.copyPositionAndSize(this.activeComponent.panel, this.panels.virtual);

		this.activeGridlines?.forEach((line) => line?.panel.RemoveClass('hud-customizer__gridline--highlight'));

		this.activeGridlines = [undefined, undefined];

		// TODO: this is just for testing
		this.save();
	}

	static getNearestGridLine(axis: AxisType, sizeFactor: number): Gridline {
		const isX = axis === 0;

		const relativeOffset = isX
			? Math.max(
					0,
					Math.min(
						1920,
						(this.panels.virtual.actualxoffset + this.panels.virtual.actuallayoutwidth * sizeFactor) /
							this.scaleX
					)
			  )
			: Math.max(
					0,
					Math.min(
						1080,
						(this.panels.virtual.actualyoffset + this.panels.virtual.actuallayoutheight * sizeFactor) /
							this.scaleY
					)
			  );

		const glIndex = Math.round((relativeOffset / (isX ? 1920 : 1080)) * this.gridlines[axis].length);

		return this.gridlines[axis][glIndex];
	}

	static createGridLines(): void {
		this.panels.grid.RemoveAndDeleteChildren();

		const numXLines = 2 ** this.gridSize;
		const numYLines = Math.floor(numXLines * (9 / 16));

		this.gridlines = [[], []];
		this.activeGridlines = [undefined, undefined];

		for (const axis of Axes) {
			const isX = axis === 0;
			const numLines = isX ? numXLines : numYLines;
			const totalLength = isX ? 1920 : 1080;

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

	static updateGridSize(): void {
		const newSize = this.panels.gridSize.value;

		if (newSize !== this.gridSize) {
			this.gridSize = newSize;
			this.createGridLines();
		}
	}

	static setSnapMode(axis: AxisType, mode: SnapMode): void {
		if (!this.activeComponent) return;

		this.activeComponent.snaps[axis] = mode;
		this.showSnapTooltip();
	}

	static showSnapTooltip(): void {
		if (!this.activeComponent) return;

		UiToolkitAPI.ShowTextTooltip(
			this.panels.snaps.id,
			'<b><i>Snapping Mode</i></b>\n' +
				`Horizontal: <b>${this.snaps[0][this.activeComponent.snaps[0]].name}</b>\n` +
				`Vertical: <b>${this.snaps[1][this.activeComponent.snaps[1]].name}</b>`
		);
	}

	static hideSnapTooltip(): void {
		UiToolkitAPI.HideTextTooltip();
	}

	static fixFloatingImprecision(n: number) {
		return +n.toPrecision(3);
	}
}
