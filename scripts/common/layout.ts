/**
 * Utility methods for handling normalised panel position and size.
 * Could be ported to C++ in future.
 */
namespace LayoutUtil {
	export type Size = [number, number];
	export type Position = [number, number];

	export function getPositionAndSize<P extends Panel>(panel: P): [Position, Size] {
		return [
			[panel.actualxoffset / panel.actualuiscale_x, panel.actualyoffset / panel.actualuiscale_y],
			[panel.actuallayoutwidth / panel.actualuiscale_x, panel.actuallayoutheight / panel.actualuiscale_y]
		];
	}

	export function setPositionAndSize<P extends Panel>(panel: P, [x, y]: Position, [width, height]: Size): P {
		Object.assign(panel.style, {
			position: `${x}px ${y}px 0px;`,
			width: `${width}px;`,
			height: `${height}px;`
		});
		return panel;
	}

	export function copyPositionAndSize<P1 extends Panel, P2 extends Panel>(sourcePanel: P1, targetPanel: P2): P2 {
		setPositionAndSize(targetPanel, ...getPositionAndSize(sourcePanel));
		return targetPanel;
	}

	export function getPosition<P extends Panel>(panel: P): Position {
		return [panel.actualxoffset / panel.actualuiscale_x, panel.actualyoffset / panel.actualuiscale_y];
	}

	export function setPosition<P extends Panel>(panel: P, [x, y]: Position): P {
		panel.style.position = `${x}px ${y}px 0px`;
		return panel;
	}

	export function copyPosition<P1 extends Panel, P2 extends Panel>(sourcePanel: P1, targetPanel: P2): P2 {
		setPosition(targetPanel, getPosition(sourcePanel));
		return targetPanel;
	}

	export function getX<P extends Panel>(panel: P): number {
		return panel.actualxoffset / panel.actualuiscale_x;
	}

	export function getY<P extends Panel>(panel: P) {
		return panel.actualyoffset / panel.actualuiscale_y;
	}

	export function getSize<P extends Panel>(panel: P): Size {
		return [panel.actuallayoutwidth / panel.actualuiscale_x, panel.actuallayoutheight / panel.actualuiscale_y];
	}

	export function setSize<P extends Panel>(panel: P, [width, height]: Position): P {
		Object.assign(panel.style, {
			width: `${width}px`,
			height: `${height}px`
		});
		return panel;
	}

	export function copySize<P1 extends Panel, P2 extends Panel>(sourcePanel: P1, targetPanel: P2): P2 {
		setSize(targetPanel, getSize(sourcePanel));
		return targetPanel;
	}

	export function getWidth<P extends Panel>(panel: P) {
		return panel.actuallayoutwidth / panel.actualuiscale_x;
	}

	export function setWidth<P extends Panel>(panel: P, width: number): P {
		panel.style.width = `${width}px`;
		return panel;
	}

	export function copyWidth<P1 extends Panel, P2 extends Panel>(sourcePanel: P1, targetPanel: P2): P2 {
		setWidth(targetPanel, getWidth(sourcePanel));
		return targetPanel;
	}

	export function getHeight<P extends Panel>(panel: P): number {
		return panel.actuallayoutheight / panel.actualuiscale_y;
	}

	export function setHeight<P extends Panel>(panel: P, height: number): P {
		panel.style.height = `${height}px`;
		return panel;
	}

	export function copyHeight<P1 extends Panel, P2 extends Panel>(sourcePanel: P1, targetPanel: P2): P2 {
		setHeight(targetPanel, getHeight(sourcePanel));
		return targetPanel;
	}
}
