'use strict';

/** @typedef {number} SnapMode */

const AXIS = [0, 1];

/*** @enum {SnapMode} */
const SNAP_MODE = {
	OFF: 0,
	CENTER: 1,
	MIN: 2,
	MAX: 3
};

/**
 * A customisable HUD component
 * @typedef {Object} Component
 * @property {Panel} panel
 * @property {Snaps} snaps
 * @property {Object} properties - TODO
 */

/**
 * @typedef {number[]} position
 */

/**
 * @typedef {Object} Snaps
 * @property {SnapMode} x - Horizontal snapping mode
 * @property {SnapMode} y - Vertical snapping mode
 */

/**
 * @typedef {Object} GridAxis
 * @property {GridLine[]} lines
 * @property {number} interval
 */

/**
 * @typedef {Object} GridLine
 * @property {Panel} panel,
 * @property {number} offset
 */

class HudCustomizer {
	static panels = {
		customizer: $('#HudCustomizer'),
		virtual: $('#HudCustomizerVirtual'),
		snaps: {
			horiz: {
				min: $('#HudCustomizerSnapsHorizLeft'),
				max: $('#HudCustomizerSnapsHorizRight'),
				center: $('#HudCustomizerSnapsHorizCenter'),
				off: $('#HudCustomizerSnapsHorizOff')
			},
			vert: {
				min: $('#HudCustomizerSnapsVertLeft'),
				max: $('#HudCustomizerSnapsVertRight'),
				center: $('#HudCustomizerSnapsVertCenter'),
				off: $('#HudCustomizerSnapsVertOff')
			}
		},
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
				const width = panel.actuallayoutwidth / this.scaleX;
				const height = panel.actuallayoutheight / this.scaleY;
				const position = [panel.actualxoffset / this.scaleX, panel.actualyoffset / this.scaleY];

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

		const width = component.panel.actuallayoutwidth / this.scaleX;
		const height = component.panel.actuallayoutheight / this.scaleY;
		const position = [component.panel.actualxoffset / this.scaleX, component.panel.actualyoffset / this.scaleY];

		Object.assign(this.panels.virtual.style, {
			width: `${width}px;`,
			height: `${height}px;`,
			position: `${position[0]}px ${position[1]}px 0px;`
		});

		let horizSnap;
		switch (component.snaps[0]) {
			default:
			case SNAP_MODE.OFF:
				horizSnap = this.panels.snaps.horiz.off;
				break;
			case SNAP_MODE.CENTER:
				horizSnap = this.panels.snaps.horiz.center;
				break;
			case SNAP_MODE.MIN:
				horizSnap = this.panels.snaps.horiz.min;
				break;
			case SNAP_MODE.MAX:
				horizSnap = this.panels.snaps.horiz.max;
				break;
		}

		let vertSnap;
		switch (component.snaps[1]) {
			default:
			case SNAP_MODE.OFF:
				vertSnap = this.panels.snaps.vert.off;
				break;
			case SNAP_MODE.CENTER:
				vertSnap = this.panels.snaps.vert.center;
				break;
			case SNAP_MODE.MIN:
				vertSnap = this.panels.snaps.vert.min;
				break;
			case SNAP_MODE.MAX:
				vertSnap = this.panels.snaps.vert.max;
				break;
		}

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);
		}

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, this.onStartDrag.bind(this));

		// This will cause the event to fire but doesn't matter
		//$.DispatchEvent('Activated', horizSnap, 'mouse');
		//$.DispatchEvent('Activated', vertSnap, 'mouse');
	}

	static setSnapMode(axis, mode) {
		this.activeComponent.snaps[axis] = mode;
		$.Msg(this.activeComponent.snaps);
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
			if (this.activeComponent.snaps[axis] === SNAP_MODE.OFF) {
				newPosition[axis] =
					axis === 0
						? this.panels.virtual.actualxoffset / this.scaleX
						: this.panels.virtual.actualyoffset / this.scaleY;
			} else {
				const gridline = this.getNearestGridLine(axis);
				const activeGridline = this.activeGridlines[axis];

				// this is completely fucking wrong lol
				let widthFactor;
				switch (this.activeComponent.snaps[axis]) {
					case SNAP_MODE.MIN:
						widthFactor = 0;
						break;
					case SNAP_MODE.MAX:
						widthFactor = 1;
						break;
					case SNAP_MODE.CENTER:
						widthFactor = 0.5;
						break;
				}

				const offset =
					(this.activeComponent.panel.actuallayoutwidth +
						this.activeComponent.panel.actuallayoutwidth * widthFactor) /
					this.scaleX;

				if (activeGridline) oldPosition[axis] = activeGridline.offset + offset;
				if (gridline) newPosition[axis] = gridline.offset + offset;

				if (gridline !== activeGridline) {
					if (activeGridline) activeGridline.panel.RemoveClass('hud-customizer__gridline--highlight');
					if (gridline) {
						gridline.panel.AddClass('hud-customizer__gridline--highlight');
						this.activeGridlines[axis] = gridline;
					}
				}
			}
		});

		if (newPosition !== oldPosition) this.setPosition(this.activeComponent.panel, newPosition);
	}

	static onEndDrag() {
		$.UnregisterEventHandler('DragEnd', this.panels.virtual, this.dragEndHandle);
		$.UnregisterEventHandler('ChaosHudThink', $.GetContextPanel(), this.onThinkHandle);

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, this.onStartDrag.bind(this));

		this.dragEndHandle = null;
		this.onThinkHandle = null;

		this.panels.virtual.RemoveClass('hud-customizer-virtual--dragging');

		// If this is all working, these gridlines will be the currently highlighted ones
		this.setPosition(
			this.panels.virtual,
			AXIS.map((axis) => {
				if (this.activeComponent.snaps[axis] === SNAP_MODE.OFF) {
					return axis === 0
						? this.panels.virtual.actualxoffset / this.scaleX
						: this.panels.virtual.actualyoffset / this.scaleY;
				} else {
					const line = this.getNearestGridLine(axis, this.activeComponent.snaps[axis]);
					line.panel.RemoveClass('hud-customizer__gridline--highlight');
					return line.offset;
				}
			})
		);

		this.activeGridlines = [null, null];
	}

	static getNearestGridLine(axis) {
		const isX = axis === 0;
		const snapMode = this.activeComponent.snaps[axis];

		let widthFactor;
		switch (snapMode) {
			case SNAP_MODE.MIN:
				widthFactor = 0;
				break;
			case SNAP_MODE.MAX:
				widthFactor = 1;
				break;
			case SNAP_MODE.CENTER:
				widthFactor = 0.5;
				break;
		}

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

		const glIndex = Math.round((relativeOffset / (isX ? 1920 : 1080)) * this.gridAxis[axis].lines.length);

		return this.gridAxis[axis].lines[glIndex];
	}

	static createGridLines() {
		this.panels.grid.RemoveAndDeleteChildren();

		const numXLines = 2 ** this.gridDensity; // Math.floor(1920 / this.gridDensity);
		const numYLines = Math.floor(numXLines * (9 / 16));

		this.gridAxis = [0, 1].map((i) => {
			const isX = i === 0;
			const numLines = isX ? numXLines : numYLines;
			const totalLength = isX ? 1920 : 1080;

			// TODO: don't think interval is needed. this simplifies a lot in that case!
			const interval = totalLength * (1 / numLines);

			const lines = Array.from({ length: numLines }, (_, i) => {
				const offset = totalLength * (i / numLines);

				let cssClass = `hud-customizer__gridline hud-customizer__gridline--${isX ? 'x' : 'y'}`;
				if (i === numLines / 2) cssClass += ' hud-customizer__gridline--center';
				if (i === 0 || i === numLines) cssClass += 'hud-customizer__gridline--edge';

				const gridline = $.CreatePanel('Panel', this.panels.grid, '', { class: cssClass });

				isX ? this.setPosition(gridline, [offset, 0]) : this.setPosition(gridline, [0, offset]);

				return {
					panel: gridline,
					offset: offset
				};
			});

			return {
				lines: lines,
				interval: interval
			};
		});
	}

	/**
	 * Set panel pos relative to 1920x1080 pano layout
	 * @param {Panel} panel
	 * @param {Position} position
	 */
	static setPosition(panel, [x, y]) {
		panel.style.position = `${x}px ${y}px 0px`;
	}
}
