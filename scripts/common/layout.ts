type Size = [number, number];
type Position = [number, number];

/**
 * Utility methods for handling normalised panel position and size.
 * Could be ported to C++ in future.
 */
const LayoutUtil = {
	getPositionAndSize: function <P extends Panel>(panel: P): [Position, Size] {
		return [
			[panel.actualxoffset / panel.actualuiscale_x, panel.actualyoffset / panel.actualuiscale_y],
			[panel.actuallayoutwidth / panel.actualuiscale_x, panel.actuallayoutheight / panel.actualuiscale_y]
		];
	},

	setPositionAndSize: function <P extends Panel>(panel: P, [x, y]: Position, [width, height]: Size): P {
		Object.assign(panel.style, {
			position: `${x}px ${y}px 0px;`,
			width: `${width}px;`,
			height: `${height}px;`
		});
		return panel;
	},

	copyPositionAndSize: function <P1 extends Panel, P2 extends Panel>(sourcePanel: P1, targetPanel: P2): P2 {
		this.setPositionAndSize(targetPanel, ...this.getPositionAndSize(sourcePanel));
		return targetPanel;
	},

	getPosition: function <P extends Panel>(panel: P): Position {
		return [panel.actualxoffset / panel.actualuiscale_x, panel.actualyoffset / panel.actualuiscale_y];
	},

	setPosition: function <P extends Panel>(panel: P, [x, y]: Position): P {
		panel.style.position = `${x}px ${y}px 0px`;
		return panel;
	},

	copyPosition: function <P1 extends Panel, P2 extends Panel>(sourcePanel: P1, targetPanel: P2): P2 {
		LayoutUtil.setPosition(targetPanel, this.getPosition(sourcePanel));
		return targetPanel;
	},

	getX: function <P extends Panel>(panel: P): number {
		return panel.actualxoffset / panel.actualuiscale_x;
	},

	getY: function <P extends Panel>(panel: P) {
		return panel.actualyoffset / panel.actualuiscale_y;
	},

	getSize: function <P extends Panel>(panel: P): Size {
		return [panel.actuallayoutwidth / panel.actualuiscale_x, panel.actuallayoutheight / panel.actualuiscale_y];
	},

	setSize: function <P extends Panel>(panel: P, [width, height]: Position): P {
		Object.assign(panel.style, {
			width: `${width}px`,
			height: `${height}px`
		});
		return panel;
	},

	copySize: function <P1 extends Panel, P2 extends Panel>(sourcePanel: P1, targetPanel: P2): P2 {
		LayoutUtil.setSize(targetPanel, this.getSize(sourcePanel));
		return targetPanel;
	},

	getWidth: function <P extends Panel>(panel: P) {
		return panel.actuallayoutwidth / panel.actualuiscale_x;
	},

	setWidth: function <P extends Panel>(panel: P, width: number): P {
		panel.style.width = `${width}px`;
		return panel;
	},

	copyWidth: function <P1 extends Panel, P2 extends Panel>(sourcePanel: P1, targetPanel: P2): P2 {
		this.setWidth(targetPanel, this.getWidth(sourcePanel));
		return targetPanel;
	},

	getHeight: function <P extends Panel>(panel: P): number {
		return panel.actuallayoutheight / panel.actualuiscale_y;
	},

	setHeight: function <P extends Panel>(panel: P, height: number): P {
		panel.style.height = `${height}px`;
		return panel;
	},

	copyHeight: function <P1 extends Panel, P2 extends Panel>(sourcePanel: P1, targetPanel: P2): P2 {
		this.setHeight(targetPanel, this.getHeight(sourcePanel));
		return targetPanel;
	}
};
