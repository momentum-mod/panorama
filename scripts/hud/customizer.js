'use strict';

/** @typedef {number} SnapMode */

const AXIS = [0, 1];

/*** @enum {SnapMode} */
const SNAP_MODE = {
	MIN: 1,
	MID: 2,
	MAX: 3,
	OFF: 4
};

/**
 * A customisable HUD component
 * @typedef {Object} Component
 * @property {Panel} panel
 * @property {Snaps} snaps
 * @property {Object} properties - TODO
 */

/**
 * @typedef {Object} Snaps
 * @property {SnapMode} x - Horizontal snapping mode
 * @property {SnapMode} y - Vertical snapping mode
 */

/**
 * @typedef {Object} GridAxis
 * @property {GridLine} x
 * @property {GridLine} y
 */

/**
 * @typedef {Object} GridLine
 * @property {Panel} panel,
 * @property {number} offset
 */

class HudCustomizer {
	static snaps = {
		0: {
			[SNAP_MODE.MIN]: {
				name: 'Left',
				button: $('#HudCustomizerSnapsXMin'),
				widthFactor: 0
			},
			[SNAP_MODE.MID]: {
				name: 'Center',
				button: $('#HudCustomizerSnapsXMid'),
				widthFactor: 0.5
			},
			[SNAP_MODE.MAX]: {
				name: 'Right',
				button: $('#HudCustomizerSnapsXMax'),
				widthFactor: 1
			},
			[SNAP_MODE.OFF]: {
				name: 'None',
				button: $('#HudCustomizerSnapsXOff'),
				widthFactor: null
			}
		},
		1: {
			[SNAP_MODE.MIN]: {
				name: 'Top',
				button: $('#HudCustomizerSnapsYMin'),
				widthFactor: 0
			},
			[SNAP_MODE.MID]: {
				name: 'Center',
				button: $('#HudCustomizerSnapsYMid'),
				widthFactor: 0.5
			},
			[SNAP_MODE.MAX]: {
				name: 'Bottom',
				button: $('#HudCustomizerSnapsYMax'),
				widthFactor: 1
			},
			[SNAP_MODE.OFF]: {
				name: 'None',
				button: $('#HudCustomizerSnapsYOff'),
				widthFactor: null
			}
		}
	};

	static panels = {
		customizer: $('#HudCustomizer'),
		virtual: $('#HudCustomizerVirtual'),
		snaps: $('#HudCustomizerSnaps'),
		grid: $('#HudCustomizerGrid')
	};

	static components;
	static gridAxis;
	/** @type {Component} activeComponent */
	static activeComponent;
	static activeGridlines;

	static dragStartHandle;
	static dragEndHandle;
	static onThinkHandle;

	static gridDensity = 5;

	static scaleX = $.GetContextPanel().actualuiscale_x;
	static scaleY = $.GetContextPanel().actualuiscale_y;

	static {
		$.RegisterForUnhandledEvent('Chat_Show', this.enableEditing.bind(this));
		$.RegisterForUnhandledEvent('Chat_Hide', this.disableEditing.bind(this));
	}

	static load() {
		this.components = [];
		this.gridAxis = [];
		this.activeGridlines = [];
		this.activeComponent = null;

		this.createGridLines();

		for (const panel of $.GetContextPanel().Children()) {
			const customizerString = panel.GetAttributeString('custom', '');

			if (customizerString) {
				const width = LayoutUtil.getWidth(panel);
				const height = LayoutUtil.getHeight(panel);
				const position = LayoutUtil.getPosition(panel);

				if ([width, height, ...position].some((x) => x > 2000)) {
					$.Warning(
						`HUD Customizer: Panel ${panel.paneltype} is stupid big, ignoring.\n` +
							`\tWidth: ${width}\tHeight: ${height}\tPosition: [${position.join(', ')}]).`
					);
					continue;
				}

				const snaps = [SNAP_MODE.OFF, SNAP_MODE.OFF];

				try {
					const properties = JSON.parse(customizerString.replace(/'/g, '"'));

					this.components.push({
						panel: panel,
						snaps: snaps,
						properties: properties
					});
				} catch {
					$.Warning(`Failed to parse customizer settings for panel ${panel.paneltype}`);
				}
			}
		}
	}

	static enableEditing() {
		// TODO: onload calls load() too early so have to do this
		if (!this.components || this.components.length === 0) this.load();

		this.panels.customizer.RemoveClass('hud-customizer--disabled');

		for (const component of this.components)
			component.panel.SetPanelEvent('onmouseover', this.onComponentMouseOver.bind(this, component));
	}

	static disableEditing() {
		for (const component of this.components) component.panel.ClearPanelEvent('onmouseover');

		$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);

		this.panels.customizer.AddClass('hud-customizer--disabled');
	}

	static onComponentMouseOver(component) {
		//if (this.activeComponent && this.activeComponent === component) return;

		this.activeComponent = component;

		// Set the virtual panel's position and size to the component we just hovered over
		LayoutUtil.copyPositionAndSize(component.panel, this.panels.virtual);

		// const xSnap = this.snaps.x[component.snaps.x].panel;
		// const ySnap = this.snaps.x[component.snaps.x].panel;

		// $.DispatchEvent('Activated', xSnap, 'mouse');
		// $.DispatchEvent('Activated', ySnap, 'mouse');

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);
		}

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, this.onStartDrag.bind(this));
	}

	static onStartDrag(_source, callback) {
		callback.displayPanel = this.panels.virtual;
		callback.removePositionBeforeDrop = false;

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
				const widthFactor = this.snaps[axis][this.activeComponent.snaps[axis]].widthFactor;

				const gridline = this.getNearestGridLine(axis, widthFactor);
				const activeGridline = this.activeGridlines[axis];

				const offset = isX
					? (this.activeComponent.panel.actuallayoutwidth * widthFactor) / this.scaleX
					: (this.activeComponent.panel.actuallayoutheight * widthFactor) / this.scaleY;

				// this can maybe simplfiy to just checking if this changed, collecting both values then if neither did, dont change position
				if (activeGridline) oldPosition[axis] = activeGridline.offset - offset;
				if (gridline) newPosition[axis] = gridline.offset - offset;

				if (gridline !== activeGridline) {
					if (activeGridline) activeGridline.panel.RemoveClass('hud-customizer__gridline--highlight');
					if (gridline) {
						gridline.panel.AddClass('hud-customizer__gridline--highlight');
						this.activeGridlines[axis] = gridline;
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

		this.panels.virtual.RemoveClass('hud-customizer-virtual--dragging');

		LayoutUtil.copyPositionAndSize(this.activeComponent.panel, this.panels.virtual);

		this.activeGridlines?.forEach((line) => line?.panel.RemoveClass('hud-customizer__gridline--highlight'));

		this.activeGridlines = [null, null];
	}

	static getNearestGridLine(axis, widthFactor) {
		const isX = axis === 0;

		const relativeOffset = Math.max(
			0,
			isX
				? Math.min(
						1920,
						(this.panels.virtual.actualxoffset + this.panels.virtual.actuallayoutwidth * widthFactor) /
							this.scaleX
				  )
				: Math.min(
						1080,
						(this.panels.virtual.actualyoffset + this.panels.virtual.actuallayoutheight * widthFactor) /
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
