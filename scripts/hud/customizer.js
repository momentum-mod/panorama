'use strict';

// Code is simplest and cheapest if just treat X, Y axis as 0, 1 so we can use an indices.
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
const DEFAULT_SNAP_MODES = [SNAP_MODE.OFF, SNAP_MODE.OFF];

/**
 * A customisable, saveable HUD component
 * @typedef {Object} Component
 * @property {Panel} panel
 * @property {Snaps} snaps
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
		$.RegisterForUnhandledEvent('HudChat_Show', this.enableEditing.bind(this));
		$.RegisterForUnhandledEvent('HudChat_Hide', this.disableEditing.bind(this));
	}

	/**  @typedef {Object.<string, StoredComponentData>} StoredData */

	/**
	 * @typedef {Object} StoredComponentData
	 * @property {Snaps} snaps
	 * @property {Position} position
	 */

	static save() {
		const saveData = Object.entries(this.components).reduce((obj, [id, data]) => {
			obj[id] = {
				position: [data.panel.actualxoffset / this.scaleX, data.panel.actualyoffset / this.scaleY],
				snaps: data.snaps
			};
			return obj;
		}, {});

		HudCustomizerAPI.SaveHudLayout(saveData);
	}

	static load() {
		HudCustomizerAPI.SaveHudLayout({ burger: 'burger' });

		this.components = [];
		this.gridAxis = [];
		this.activeGridlines = [];
		this.activeComponent = null;

		this.createGridLines();

		/** @type {StoredData} */
		const storedLayout = HudCustomizerAPI.LoadHudLayout() ?? {};

		for (const panel of $.GetContextPanel().Children()) {
			if (panel.GetAttributeString('customisable', '') !== 'true') continue;

			const storedPanelData = storedLayout[panel.id];

			if (storedPanelData) {
				let snaps = storedPanelData.snaps;
				snaps.forEach((snap, i) => {
					if (!Object.values(SNAP_MODE).includes(snap)) {
						$.Warning(`HudCustomizer: Invalid snap values ${snap}, setting to default.`);
						snaps[i] = DEFAULT_SNAP_MODES;
					}
				});

				let position = storedPanelData.position;
				position.forEach((pos, i) => {
					const max = i === 0 ? 1920 : 1080;
					// TODO: stronger version of this once position+snapping setup i invented when down the shops is done
					if (pos < 0 || pos >= max) {
						$.Warning(
							`HudCustomizer: Invalid position value ${pos}, should be in [0, ${max}) interval, setting to default.`
						);
						pos[i] = 0;
					}
				});

				// next handle storage object better
			} else {
				const [position, size] = LayoutUtil.getPositionAndSize(panel);

				// TODO: can probs get rid of this
				if ([position, size].flat().some((x) => x > 2000)) {
					$.Warning(
						`HudCustomizer: Panel ${panel.paneltype} is stupid big, ignoring.\n` +
							`\tWidth: ${size[0]}\tHeight: ${size[1]}\tPosition: [${position.join(', ')}]).`
					);
					continue;
				}

				const storedCompData = storedLayout[panel.id];

				let snaps;
				if (storedCompData) {
					snaps = storedCompData.snaps;
					LayoutUtil.setPosition(panel, storedCompData.position);
				} else {
					snaps = [SNAP_MODE.OFF, SNAP_MODE.OFF];
				}

				AXIS.forEach((axis) => this.snaps[axis][snaps[axis]].button.SetSelected(true));

				this.components[panel.id] = {
					panel: panel,
					snaps: snaps
				};
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

		const xSnap = this.snaps[0][component.snaps[0]].button;
		const ySnap = this.snaps[1][component.snaps[1]].button;

		$.DispatchEvent('Activated', xSnap.id, 'mouse');
		ySnap.SetSelected(true);

		if (this.dragStartHandle) {
			$.UnregisterEventHandler('DragStart', this.panels.virtual, this.dragStartHandle);
		}

		this.dragStartHandle = $.RegisterEventHandler('DragStart', this.panels.virtual, this.onStartDrag.bind(this));
	}

	static onStartDrag(_source, callback) {
		callback.displayPanel = this.panels.virtual;
		callback.removePositionBeforeDrop = false;

		this.panels.virtual.SetParent(null);

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

				const offset = isX
					? (this.activeComponent.panel.actuallayoutwidth * widthFactor) / this.scaleX
					: (this.activeComponent.panel.actuallayoutheight * widthFactor) / this.scaleY;

				const gridline = this.getNearestGridLine(axis, widthFactor);
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

		this.panels.virtual.RemoveClass('hud-customizer-virtual--dragging');

		LayoutUtil.copyPositionAndSize(this.activeComponent.panel, this.panels.virtual);

		this.activeGridlines?.forEach((line) => line?.panel.RemoveClass('hud-customizer__gridline--highlight'));

		this.activeGridlines = [null, null];

		// TODO: this is just for testing
		this.save();
	}

	static getNearestGridLine(axis, widthFactor) {
		const isX = axis === 0;

		const relativeOffset = isX
			? Math.max(
					0,
					Math.min(
						1920,
						(this.panels.virtual.actualxoffset + this.panels.virtual.actuallayoutwidth * widthFactor) /
							this.scaleX
					)
			  )
			: Math.max(
					0,
					Math.min(
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
		$.Msg('setsafdsdf');
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
