'use strict';

/**
 * A customisable HUD component
 * @typedef {Object} Component
 * @property {Panel} panel
 * @property {Object} properties - TODO
 * @property {boolean} oldHitTest - Stores hittest state before panel was made draggable
 * @property {boolean} oldHitTestChildren - - Stores hittestchildren state before panel was made draggable
 *
 */

class HudCustomizer {
	static panels = {
		customizer: $('#HudCustomizer')
	};

	/** @type Component[] */
	static components;
	static gridlines = {
		x: [],
		y: []
	};

	static snapPrecision = 8;
	static gridDensity = 4;

	static scaleX = $.GetContextPanel().actualuiscale_x;
	static scaleY = $.GetContextPanel().actualuiscale_y;

	static {
		$.RegisterForUnhandledEvent('Chat_Show', this.enableEditing.bind(this));
		$.RegisterForUnhandledEvent('Chat_Hide', this.disableEditing.bind(this));
	}

	static load() {
		this.components = [];

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
		this.gridlines.x.forEach((line) =>
			line.SetHasClass(
				'hud-customizer__gridline--highlight',
				Math.abs(line.actualxoffset - (component.panel.actualxoffset + component.panel.actuallayoutwidth / 2)) <
					this.snapPrecision
			)
		);

		this.gridlines.y.forEach((line) =>
			line.SetHasClass(
				'hud-customizer__gridline--highlight',
				Math.abs(
					line.actualyoffset - (component.panel.actualyoffset + component.panel.actuallayoutheight / 2)
				) < this.snapPrecision
			)
		);
	}

	static onEndDrag(component, source, callback) {
		$.UnregisterEventHandler('DragEnd', component.panel, component.dragEndHandle);
		$.UnregisterEventHandler('ChaosHudThink', component.panel, component.onThinkHandle);

		const xSnapLine = this.gridlines.x.find((line) => line.HasClass('hud-customizer__gridline--highlight'));
		const ySnapLine = this.gridlines.y.find((line) => line.HasClass('hud-customizer__gridline--highlight'));

		const xPos =
			(xSnapLine
				? xSnapLine.actualxoffset - component.panel.actuallayoutwidth / 2
				: component.panel.actualxoffset) / this.scaleX;
		const yPos =
			(ySnapLine
				? ySnapLine.actualyoffset - component.panel.actuallayoutheight / 2
				: component.panel.actualyoffset) / this.scaleY;

		component.panel.style.position = `${xPos}px ${yPos}px 0px`;
	}

	static createGridLines() {
		this.panels.customizer.RemoveAndDeleteChildren();

		this.gridlines.x = [];
		this.gridlines.y = [];

		const numYLines = 2 ** this.gridDensity; // Math.floor(1920 / this.gridDensity);
		const numXLines = numYLines * (this.scaleX / this.scaleY) * (16 / 9);

		for (let i = 1; i < numXLines; i++) {
			const offset = 1920 * (i / numXLines);
			this.gridlines.x.push(
				$.CreatePanel('Panel', this.panels.customizer, '', {
					class:
						'hud-customizer__gridline hud-customizer__gridline--x' +
						(i === numXLines / 2 ? ' hud-customizer__gridline--center' : ''),
					style: `position: ${offset}px 0px 0px`,
					offset: offset
				})
			);
		}

		for (let i = 1; i < numYLines; i++) {
			const offset = 1080 * (i / numYLines);
			this.gridlines.y.push(
				$.CreatePanel('Panel', this.panels.customizer, '', {
					class:
						'hud-customizer__gridline hud-customizer__gridline--y' +
						(i === numYLines / 2 ? ' hud-customizer__gridline--center' : ''),
					style: `position: 0px ${offset}px 0px`,
					offset: offset
				})
			);
		}
	}
}
