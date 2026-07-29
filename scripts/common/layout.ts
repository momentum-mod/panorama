/**
 * Utility methods for handling normalised panel position and size.
 *
 * This probably isn't very performant, what with the endless dynamic string allocs + UTF8 conversion and unit parsing
 * done in C++. A faster approach would be to expose a 2-arg method that takes a length and EUILengthTypes value.
 * If we want to do that, we should dispose of this module entirely, and maybe add an option to apply actualuiscale
 * factors automatically on the C++ side -- SetPosition is doing something like that already.
 *
 * Previously this used [number, number] pairs for position and size, which was nice when looping over x/y axes, but
 * JS arrays always being passed by reference can make values harder to reason about and lead to funky bugs.
 */

export function getPositionAndSize<P extends GenericPanel>(panel: P): [x: number, y: number, w: number, h: number] {
	return [
		panel.actualxoffset / panel.actualuiscale_x,
		panel.actualyoffset / panel.actualuiscale_y,
		panel.actuallayoutwidth / panel.actualuiscale_x,
		panel.actuallayoutheight / panel.actualuiscale_y
	];
}

export function setPositionAndSize<P extends GenericPanel>(panel: P, x: number, y: number, w: number, h: number): P {
	Object.assign(panel.style, {
		position: `${x}px ${y}px 0px;`,
		width: `${w}px;`,
		height: `${h}px;`
	});
	return panel;
}

export function getPosition<P extends GenericPanel>(panel: P): [x: number, y: number] {
	return [panel.actualxoffset / panel.actualuiscale_x, panel.actualyoffset / panel.actualuiscale_y];
}

// // TODO: If we really go with this approach, *definitely* expose C++ methods for this, then no need for the
// // JS bullshit - setX/setY in C++ can access individual elements of the CStylePropertyPosition
// export function setX<P extends GenericPanel>(panel: P, x: number): P {
// 	panel.style.position = `${x}px ${getY(panel)}px 0px`;
// 	return panel;
// }
//
// export function setY<P extends GenericPanel>(panel: P, y: number): P {
// 	panel.style.position = `${getX(panel)}px ${y}px 0px`;
// 	return panel;
// }

export function setPosition<P extends GenericPanel>(panel: P, x: number, y: number): P {
	panel.style.position = `${x}px ${y}px 0px`;
	return panel;
}

export function getX<P extends GenericPanel>(panel: P): number {
	return panel.actualxoffset / panel.actualuiscale_x;
}

export function getY<P extends GenericPanel>(panel: P) {
	return panel.actualyoffset / panel.actualuiscale_y;
}

export function getSize<P extends GenericPanel>(panel: P): [w: number, h: number] {
	return [panel.actuallayoutwidth / panel.actualuiscale_x, panel.actuallayoutheight / panel.actualuiscale_y];
}

export function setSize<P extends GenericPanel>(panel: P, [width, height]: [x: number, h: number]): P {
	Object.assign(panel.style, {
		width: `${width}px`,
		height: `${height}px`
	});
	return panel;
}

export function getWidth<P extends GenericPanel>(panel: P) {
	return panel.actuallayoutwidth / panel.actualuiscale_x;
}

export function setWidth<P extends GenericPanel>(panel: P, width: number): P {
	panel.style.width = `${width}px`;
	return panel;
}

export function getHeight<P extends GenericPanel>(panel: P): number {
	return panel.actuallayoutheight / panel.actualuiscale_y;
}

export function setHeight<P extends GenericPanel>(panel: P, height: number): P {
	panel.style.height = `${height}px`;
	return panel;
}
