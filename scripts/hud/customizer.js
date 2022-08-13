'use strict';

/**
 * A customisable HUD component
 * @typedef {Object} Component
 * @property {Panel} panel
 * @property {Object} properties - TODO
 * @property {boolean} oldHitTest - Stores hittest state before panel was made draggable
 * @property {boolean} oldHitTestChildren - - Stores hittestchildren state before panel was made draggable
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
		customizer: $('#HudCustomizer')
	};

	static components;
	static gridAxis;
	static activeGridlines;

	static snapPrecision = 8;
	static gridDensity = 6;

	static scaleX = $.GetContextPanel().actualuiscale_x;
	static scaleY = $.GetContextPanel().actualuiscale_y;

	static {
		$.RegisterForUnhandledEvent('Chat_Show', this.enableEditing.bind(this));
		$.RegisterForUnhandledEvent('Chat_Hide', this.disableEditing.bind(this));
	}

	static load() {
		$.Msg('ive been loaded!');
		this.components = [];
		this.gridAxis = [];

		for (const panel of $.GetContextPanel().Children()) {
			const customiserString = panel.GetAttributeString('custom', '');
			if (customiserString && panel.id)
				try {
					this.components.push({
						panel: panel,
						properties: JSON.parse(customiserString.replace(/'/g, '"'))
					});
				} catch {
					$.Warning(`Failed to parse customizer settings for panel ${panel.paneltype}`);
				}
		}
	}

	static enableEditing() {
		this.activeGridlines = [null, null];

		// TODO: onload calls load() too early so have to do this
		if (!this.components || this.components.length === 0) this.load();

		// TODO: move to onload in future
		this.createGridLines();

		this.panels.customizer.RemoveClass('hud-customizer--disabled');

		for (const component of this.components) {
			component.panel.AddClass('hud__item--active');

			component.panel.SetDraggable(true);

			component.oldHitTest = component.panel.hittest;
			component.oldHitTestChildren = component.panel.hittestchildren;
			component.panel.hittest = true;
			component.panel.hittestchildren = false;

			component.dragStartHandle = $.RegisterEventHandler(
				'DragStart',
				component.panel,
				this.onStartDrag.bind(this, component)
			);
		}
	}

	static disableEditing() {
		this.panels.customizer.AddClass('hud-customizer--disabled');

		for (const component of this.components) {
			component.panel.RemoveClass('hud__item--active');

			component.panel.SetDraggable(false);

			component.panel.hittest = component.oldHitTest;
			component.panel.hittestchildren = component.oldHitTestChildren;

			$.UnregisterEventHandler('DragStart', component.panel, component.dragStartHandle);
		}
	}

	/**
	 * Fired when a panel starts to be dragged
	 * @param {Component} component
	 */
	static onStartDrag(component, source, callback) {
		callback.displayPanel = component.panel;
		callback.removePositionBeforeDrop = false;

		component.callback = callback;

		$.Msg('what');

		component.onThinkHandle = $.RegisterEventHandler(
			'ChaosHudThink',
			component.panel,
			this.onDragThink.bind(this, component)
		);

		component.dragEndHandle = $.RegisterEventHandler(
			'DragEnd',
			component.panel,
			this.onEndDrag.bind(this, component)
		);
	}

	static onDragThink(component) {
		$.Msg('hewwo??');
		this.getNearestGridLines(component).forEach((line, i) => {
			const activeGridline = this.activeGridlines[i];

			if (line !== activeGridline) {
				if (activeGridline) activeGridline.panel.RemoveClass('hud-customizer__gridline--highlight');

				if (!line) return;

				line.panel.AddClass('hud-customizer__gridline--highlight');
				this.activeGridlines[i] = line;
			}
		});
	}

	static onEndDrag(component, source, callback) {
		$.UnregisterEventHandler('DragEnd', component.panel, component.dragEndHandle);
		$.UnregisterEventHandler('ChaosHudThink', component.panel, component.onThinkHandle);

		component.dragEndHandle = null;
		component.onThinkHandle = null;

		const gridlines = this.getNearestGridLines(component);
		this.setPosition(
			component.panel,
			// gridlines[0].offset - component.panel.actuallayoutwidth / 2 / this.scaleX,
			// gridlines[1].offset - component.panel.actuallayoutheight / 2 / this.scaleY
			gridlines[0].offset,
			gridlines[1].offset
		);

		// If this is working, these gridlines will be the currently highlighted ones
		gridlines.forEach((line) => line.panel.RemoveClass('hud-customizer__gridline--highlight'));
		this.activeGridlines = [null, null];

		// const xSnapLine = this.gridlines.x.find((line) => line.panel.HasClass('hud-customizer__gridline--highlight'));
		// const ySnapLine = this.gridlines.y.find((line) => line.panel.HasClass('hud-customizer__gridline--highlight'));

		// const xPos =
		// 	(xSnapLine
		// 		? xSnapLine.actualxoffset - component.panel.actuallayoutwidth / 2
		// 		: component.panel.actualxoffset) / this.scaleX;
		// const yPos =
		// 	(ySnapLine
		// 		? ySnapLine.actualyoffset - component.panel.actuallayoutheight / 2
		// 		: component.panel.actualyoffset) / this.scaleY;

		// component.panel.style.position = `${xPos}px ${yPos}px 0px`;
	}

	/**
	 * @param {Component} component
	 * @returns {[GridLine | null, GridLine | null] } X then Y GridLine, or null if at edge
	 */
	static getNearestGridLines(component) {
		return this.gridAxis.map((axis, i) => {
			const isX = i === 0;
			const panelOffset = isX ? component.panel.actualxoffset : component.panel.actualyoffset;

			// const relativePanelOffset = isX
			// 	? (component.panel.actualxoffset + component.panel.actuallayoutwidth / 2) / this.scaleX
			// 	: (component.panel.actualyoffset + component.panel.actuallayoutheight / 2) / this.scaleY;

			const relativePanelOffsetLeft = isX
				? Math.max(0, Math.min(1920, component.panel.actualxoffset / this.scaleX))
				: Math.max(0, Math.min(1080, component.panel.actualyoffset / this.scaleY));

			const distLeft = (relativePanelOffsetLeft / (isX ? 1920 : 1080)) * axis.lines.length;

			const relativePanelOffsetRight = isX
				? Math.max(
						0,
						Math.min(
							1920,
							(component.panel.actualxoffset + component.panel.actuallayoutwidth) / this.scaleX
						)
				  )
				: Math.max(
						0,
						Math.min(
							1080,
							(component.panel.actualyoffset + component.panel.actuallayoutheight) / this.scaleY
						)
				  );

			const distRight = (relativePanelOffsetRight / (isX ? 1920 : 1080)) * axis.lines.length;

			const glIndex =
				Math.abs(distLeft) + 1000 > Math.abs(distRight) ? Math.round(distLeft) : Math.round(distRight);

			if (i === 0) $.Msg(panelOffset, ' ', glIndex, ' ', axis.lines.length);

			return axis.lines[glIndex];
		});
	}

	static createGridLines() {
		this.panels.customizer.RemoveAndDeleteChildren();

		const numXLines = 2 ** this.gridDensity; // Math.floor(1920 / this.gridDensity);
		const numYLines = Math.floor(numXLines * (9 / 16));

		this.gridAxis = [0, 1].map((i) => {
			const isX = i === 0;
			const numLines = isX ? numXLines : numYLines;
			const totalLength = isX ? 1920 : 1080;
			const interval = totalLength * (1 / numLines);

			const lines = Array.from({ length: numLines }, (_, i) => {
				const offset = totalLength * (i / numLines);

				let cssClass = `hud-customizer__gridline hud-customizer__gridline--${isX ? 'x' : 'y'}`;
				if (i === numLines / 2) cssClass += ' hud-customizer__gridline--center';
				if (i === 0 || i === numLines) cssClass += 'hud-customizer__gridline--edge';

				const gridline = $.CreatePanel('Panel', this.panels.customizer, '', { class: cssClass });

				isX ? this.setPosition(gridline, offset, 0) : this.setPosition(gridline, 0, offset);

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
	 * @param {number} x
	 * @param {number} y
	 */
	static setPosition(panel, x = 0, y = 0) {
		panel.style.position = `${x}px ${y}px 0px`;
	}
}
