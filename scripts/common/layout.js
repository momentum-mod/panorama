'use strict';

/**
 * @typedef {[number, number]} Position - Tuple of x,y coordinates
 * @typedef {[number, number]} Size - Tuple of width, height values
 */

/**
 * Utility methods for handling normalised panel position and size.
 * Could be ported to C++ in future.
 */
const LayoutUtil = {
	/**
	 * @param {Panel} panel
	 * @returns {[Position, Size]}
	 */
	getPositionAndSize: (panel) => {
		return [
			[panel.actualxoffset / panel.actualuiscale_x, panel.actualyoffset / panel.actualuiscale_y],
			[panel.actuallayoutwidth / panel.actualuiscale_x, panel.actuallayoutheight / panel.actualuiscale_y]
		];
	},

	/**
	 * @param {Panel} panel
	 * @param {Position} position
	 * @param {Size} size
	 * @returns {Panel}
	 */
	setPositionAndSize: (panel, [x, y], [width, height]) => {
		Object.assign(panel.style, {
			position: `${x}px ${y}px 0px;`,
			width: `${width}px;`,
			height: `${height}px;`
		});
		return panel;
	},

	/**
	 * @param {Panel} sourcePanel
	 * @param {Panel} targetPanel
	 * @returns {Panel} targetPanel
	 */
	copyPositionAndSize: (sourcePanel, targetPanel) => {
		LayoutUtil.setPositionAndSize(targetPanel, ...LayoutUtil.getPositionAndSize(sourcePanel));
		return targetPanel;
	},

	/**
	 * @param {Panel} panel
	 * @returns {Position}
	 */
	getPosition: (panel) => [panel.actualxoffset / panel.actualuiscale_x, panel.actualyoffset / panel.actualuiscale_y],

	/**
	 * @param {Panel} panel
	 * @param {Position} position
	 * @returns {Panel}
	 */
	setPosition: (panel, [x, y]) => {
		panel.style.position = `${x}px ${y}px 0px`;
		return panel;
	},

	/**
	 * @param {Panel} sourcePanel
	 * @param {Panel} targetPanel
	 * @returns {Panel} targetPanel
	 */
	copyPosition: (sourcePanel, targetPanel) => {
		LayoutUtil.setPosition(targetPanel, ...LayoutUtil.getPosition(sourcePanel));
		return targetPanel;
	},

	/**
	 * @param {Panel} panel
	 * @returns {number}
	 */
	getX: (panel) => panel.actualxoffset / panel.actualuiscale_x,

	/**
	 * @param {Panel} panel
	 * @returns {number}
	 */
	getY: (panel) => panel.actualyoffset / panel.actualuiscale_y,

	/**
	 * @param {Panel} panel
	 * @returns {Size}
	 */
	getSize: (panel) => [
		panel.actuallayoutwidth / panel.actualuiscale_x,
		panel.actuallayoutheight / panel.actualuiscale_y
	],

	/**
	 *
	 * @param {Panel} panel
	 * @param {Size} size
	 * @returns {Panel}
	 */
	setSize: (panel, [width, height]) => {
		Object.assign(panel.style, {
			width: `${width}px`,
			height: `${height}px`
		});
		return panel;
	},

	/**
	 * @param {Panel} sourcePanel
	 * @param {Panel} targetPanel
	 * @returns {Panel} targetPanel
	 */
	copySize: (sourcePanel, targetPanel) => {
		LayoutUtil.setSize(targetPanel, ...LayoutUtil.getSize(sourcePanel));
		return targetPanel;
	},

	/**
	 * @param {Panel} panel
	 * @returns {number}
	 */
	getWidth: (panel) => panel.actuallayoutwidth / panel.actualuiscale_x,

	/**
	 * @param {Panel} panel
	 * @param {number} width
	 * @returns {Panel}
	 */
	setWidth: (panel, width) => {
		panel.style.width = `${width}px`;
		return panel;
	},

	/**
	 * @param {Panel} sourcePanel
	 * @param {Panel} targetPanel
	 * @returns {Panel} targetPanel
	 */
	copyWidth: (sourcePanel, targetPanel) => {
		LayoutUtil.setWidth(targetPanel, ...LayoutUtil.getWidth(sourcePanel));
		return targetPanel;
	},

	/**
	 * @param {Panel} panel
	 * @returns {number}
	 */
	getHeight: (panel) => panel.actuallayoutheight / panel.actualuiscale_y,

	/**
	 * @param {Panel} panel
	 * @param {number} height
	 * @returns {Panel}
	 */
	setHeight: (panel, height) => {
		panel.style.height = `${height}px`;
		return panel;
	},

	/**
	 * @param {Panel} sourcePanel
	 * @param {Panel} targetPanel
	 * @returns {Panel} targetPanel
	 */
	copyHeight: (sourcePanel, targetPanel) => {
		LayoutUtil.setHeight(targetPanel, ...LayoutUtil.getHeight(sourcePanel));
		return targetPanel;
	}
};
