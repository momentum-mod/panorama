'use strict';

// Code is simplest and cheapest if just treat X, Y axis as 0, 1 so we can use as indices.
const AXIS = [0, 1];

/** @typedef {number} SnapMode */

/**
 * The four different snapping behaviours
 * For a horizontal panel, min and max are left and right respectively, for vertical, top and bottom
 * @enum {SnapMode}
 */
const SNAP_MODE = {
	MIN: 1,
	MID: 2,
	MAX: 3,
	OFF: 4
};
const SNAP_MODE_VALS = Object.values(SNAP_MODE);
const DEFAULT_SNAP_MODES = [SNAP_MODE.OFF, SNAP_MODE.OFF];

/**
 * A customisable, saveable HUD component
 * @typedef {Object} Component
 * @property {Panel} panel
 * @property {Snaps} snaps
 * @property {Position} position
 * @property {Object} properties - TODO
 */

/**
 * @typedef {[SnapMode, SnapMode]} Snaps
 * @property {SnapMode} x - Horizontal snapping mode
 * @property {SnapMode} y - Vertical snapping mode
 */

/**
 * @typedef {Object} GridLine
 * @property {Panel} panel,
 * @property {number} offset
 */

/** @typedef {[GridLine, GridLine]} GridAxis */

class HudCustomizer {
	static snaps = {
		0: {
			[SNAP_MODE.MIN]: {
				name: 'Left',
				button: $('#HudCustomizerSnapsXMin'),
				sizeFactor: 0
			},
			[SNAP_MODE.MID]: {
				name: 'Center',
				button: $('#HudCustomizerSnapsXMid'),
				sizeFactor: 0.5
			},
			[SNAP_MODE.MAX]: {
				name: 'Right',
				button: $('#HudCustomizerSnapsXMax'),
				sizeFactor: 1
			},
			[SNAP_MODE.OFF]: {
				name: 'None',
				button: $('#HudCustomizerSnapsXOff'),
				sizeFactor: 0
			}
		},
		1: {
			[SNAP_MODE.MIN]: {
				name: 'Top',
				button: $('#HudCustomizerSnapsYMin'),
				sizeFactor: 0
			},
			[SNAP_MODE.MID]: {
				name: 'Center',
				button: $('#HudCustomizerSnapsYMid'),
				sizeFactor: 0.5
			},
			[SNAP_MODE.MAX]: {
				name: 'Bottom',
				button: $('#HudCustomizerSnapsYMax'),
				sizeFactor: 1
			},
			[SNAP_MODE.OFF]: {
				name: 'None',
				button: $('#HudCustomizerSnapsYOff'),
				sizeFactor: 0
			}
		}
	};

	static panels = {
		customizer: $('#HudCustomizer'),
		virtual: $('#HudCustomizerVirtual'),
		virtualName: $('#HudCustomizerVirtualName'),
		snaps: $('#HudCustomizerSnaps'),
		grid: $('#HudCustomizerGrid')
	};

	static components;
	static gridAxis;
	static activeComponent;
	static activeGridlines;

	static dragStartHandle;
	static dragEndHandle;
	static onThinkHandle;

	static gridDensity = 5;

	static scaleX = $.GetContextPanel().actualuiscale_x;
	static scaleY = $.GetContextPanel().actualuiscale_y;

	static {
		$.RegisterForUnhandledEvent('HudChat_Show', this.enableEditing.bind(this));
		$.RegisterForUnhandledEvent('HudChat_Hide', this.disableEditing.bind(this));
	}

	static save() {
		const saveData = {};
		const fixFloatingImprecision = (num) => +num.toPrecision(3);

		for (const [id, component] of Object.entries(this.components)) {
			const posX = fixFloatingImprecision(
				LayoutUtil.getX(component.panel) +
					LayoutUtil.getWidth(component.panel) * this.snaps[0][component.snaps[0]].sizeFactor
			);
			const posY = fixFloatingImprecision(
				LayoutUtil.getX(component.panel) +
					LayoutUtil.getHeight(component.panel) * this.snaps[1][component.snaps[1]].sizeFactor
			);

			saveData[id] = {
				position: [posX, posY],
				snaps: component.snaps
			};
		}

		HudCustomizerAPI.SaveHudLayout(saveData);
	}

	static load() {
		this.gridAxis = [];
		this.activeGridlines = [];
		this.activeComponent = null;

		this.createGridLines();

		const layout = HudCustomizerAPI.LoadHudLayout();

		this.components = {};

		try {
			for (const [id, data] of Object.entries(layout ?? {})) {
				this.components[id] = {
					position: Object.values(data.position),
					snaps: Object.values(data.snaps)
				};
			}
		} catch {
			$.Warning('HudCustomizer: Failed to parse layout file!');
			return;
		}

		$.GetContextPanel()
			.Children()
			.filter((panel) => panel.GetAttributeString('customisable', '') === 'true')
			.forEach((panel) => this.loadComponentPanel(panel));
	}

	static loadComponentPanel(panel) {
		let component = this.components[panel.id];

		if (component) {
			const snaps = component.snaps;
			snaps.forEach((snap, i) => {
				if (!SNAP_MODE_VALS.includes(snap)) {
					$.Warning(`HudCustomizer: Invalid snap values ${snap}, setting to default.`);
					snaps[i] = DEFAULT_SNAP_MODES[i];
				}
			});

			const layoutPos = component.position.map((len, i) => {
				if (isNaN(len)) {
					$.Warning(`HudCustomizer: Loaded invalid position ${len}, setting to 0.`);
					len = 0;
				}

				const isX = i === 0;
				const max = isX ? 1920 : 1080;
				const sf = this.snaps[i][snaps[i]].sizeFactor;
				const panelLen = isX ? LayoutUtil.getWidth(panel) : LayoutUtil.getHeight(panel);
				let layoutLen = len - panelLen * sf;
				const maxOOB = 16;

				const warningMsg = () =>
					$.Warning(
						`HudCustomizer: Panel ${panel.id} is too far off-screen (${
							isX ? 'x' : 'y'
						} = ${layoutLen}), nudging on-screen.`
					);

				if (layoutLen < 0 && layoutLen + panelLen < maxOOB) {
					warningMsg();
					layoutLen = 0;
				} else if (layoutLen + panelLen > max - maxOOB) {
					warningMsg();
					layoutLen = max - panelLen;
				}

				return layoutLen;
			});

			LayoutUtil.setPosition(panel, layoutPos);

			component.panel = panel;
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
						`\tWidth: ${size[0]}\tHeight: ${size[1]}\tPosition: [${position.join(', ')}]).`
				);
				return;
			}

			$.Msg(
				`HudCustomizer: Found a customizable HUD element that isn't stored, initialising with default values.`
			);

			this.components[panel.id] = {
				panel: panel,
				snaps: DEFAULT_SNAP_MODES
			};
		}
	}

	static enableEditing() {
		// Onload calls load() too early so have to do this
		if (!this.components || Object.keys(this.components.length) === 0) this.load();

		this.panels.customizer.AddClass('hud-customizer--enabled');

		Object.values(this.components).forEach((component) => {
			component.panel.AddClass('hud-customizable');
			component.panel.SetPanelEvent('onmouseover', this.onComponentMouseOver.bind(this, component));
		});
	}

	static disableEditing() {
		this.panels.customizer.RemoveClass('hud-customizer--enabled');

		Object.values(this.components).forEach((component) => {
			component.panel.RemoveClass('hud-customizable');
			component.panel.ClearPanelEvent('onmouseover');
		});

		$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);
	}

	static onComponentMouseOver(component) {
		if (this.activeComponent && this.activeComponent === component) return;

		this.activeComponent?.panel.RemoveClass('hud-customizable--active');

		this.activeComponent = component;

		this.activeComponent.panel.AddClass('hud-customizable--active');

		// Set the virtual panel's position and size to the component we just hovered over
		LayoutUtil.copyPositionAndSize(this.activeComponent.panel, this.panels.virtual);

		// This is going to be weird to localise, but I guess we could do it, probably in V2 when we can
		// define the locale string in the `customisable` XML property.
		this.panels.virtualName.text = this.activeComponent.panel.id;
		const size = Math.min(
			LayoutUtil.getHeight(this.activeComponent.panel) / 2,
			LayoutUtil.getWidth(this.activeComponent.panel) / 2
		);
		$.Msg('size: ', size);
		this.panels.virtualName.style.fontSize = size + 'px';

		this.snaps[0][this.activeComponent.snaps[0]].button.SetSelected(true);
		this.snaps[1][this.activeComponent.snaps[1]].button.SetSelected(true);

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);
		}

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, this.onStartDrag.bind(this));
	}

	static onStartDrag(_source, callback) {
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
		let oldPosition = [0, 0];
		let newPosition = [0, 0];

		AXIS.forEach((axis) => {
			const isX = axis === 0;

			if (this.activeComponent.snaps[axis] === SNAP_MODE.OFF) {
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
		});

		if (newPosition !== oldPosition) LayoutUtil.setPosition(this.activeComponent.panel, newPosition);
	}

	static onEndDrag() {
		$.UnregisterEventHandler('DragEnd', this.panels.virtual, this.dragEndHandle);
		$.UnregisterEventHandler('ChaosHudThink', $.GetContextPanel(), this.onThinkHandle);

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, this.onStartDrag.bind(this));

		this.dragEndHandle = null;
		this.onThinkHandle = null;

		this.activeComponent.panel.RemoveClass('hud-customizable--dragging');
		this.panels.virtual.RemoveClass('hud-customizer-virtual--dragging');

		LayoutUtil.copyPositionAndSize(this.activeComponent.panel, this.panels.virtual);

		this.activeGridlines?.forEach((line) => line?.panel.RemoveClass('hud-customizer__gridline--highlight'));

		this.activeGridlines = [null, null];

		// TODO: this is just for testing
		this.save();
	}

	static getNearestGridLine(axis, sizeFactor) {
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

		const glIndex = Math.round((relativeOffset / (isX ? 1920 : 1080)) * this.gridAxis[axis].length);

		return this.gridAxis[axis][glIndex];
	}

	static createGridLines() {
		this.panels.grid.RemoveAndDeleteChildren();

		const numXLines = 2 ** this.gridDensity;
		const numYLines = Math.floor(numXLines * (9 / 16));

		this.gridAxis = [];
		AXIS.forEach((axis) => {
			const isX = axis === 0;
			const numLines = isX ? numXLines : numYLines;
			const totalLength = isX ? 1920 : 1080;

			const lines = Array.from({ length: numLines }, (_, i) => {
				const offset = totalLength * (i / numLines);

				let cssClass = `hud-customizer__gridline hud-customizer__gridline--${isX ? 'x' : 'y'}`;
				if (i === numLines / 2) cssClass += ' hud-customizer__gridline--mid';
				if (i === 0 || i === numLines) cssClass += 'hud-customizer__gridline--edge';

				const gridline = $.CreatePanel('Panel', this.panels.grid, '', { class: cssClass });

				LayoutUtil.setPosition(gridline, isX ? [offset, 0] : [0, offset]);

				return {
					panel: gridline,
					offset: offset
				};
			});

			this.gridAxis[axis] = lines;
		});
	}

	static setSnapMode(axis, mode) {
		this.activeComponent.snaps[axis] = mode;
		this.showSnapTooltip();
	}

	static showSnapTooltip() {
		UiToolkitAPI.ShowTextTooltip(
			this.panels.snaps.id,
			`<b><i>Snapping Mode</i></b>\n` +
				`Horizontal: <b>${this.snaps[0][this.activeComponent.snaps[0]].name}</b>\n` +
				`Vertical: <b>${this.snaps[1][this.activeComponent.snaps[1]].name}</b>`
		);
	}

	static hideSnapTooltip() {
		UiToolkitAPI.HideTextTooltip();
	}
}
