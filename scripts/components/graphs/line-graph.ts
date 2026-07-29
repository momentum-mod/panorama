import { PanelHandler } from 'util/module-helpers';

export interface Point {
	x: number;
	y: number;
	id?: string;
	events?: Record<string, (id: string) => void>;
	class?: string;
	selectionSize?: number;
}

export interface Line {
	points: Point[];
	color: string;
	thickness: number;
	shadeAboveToOriginColor?: string;
	shadeBelowToOriginColor?: string;
}

export interface Axis {
	max: number;
	min: number;
	interval: number;
	name: string;
	timeBased: boolean;
}

/**
 * Class for the basic line graph component.
 *
 * This could be improved in the future to allow dynamically adding/modifying/removing points,
 * for now we just set the class properties then redraw it.
 */
@PanelHandler({ exposeToPanel: true })
export class LineGraphHandler {
	width = 0;
	height = 0;

	lines: Line[] = [];
	axis: Axis[] = [];

	readonly panels = {
		grid: $('#Grid'),
		graphContainer: $('#GraphContainer')
	};

	constructor() {
		this.width = 0;
		this.height = 0;
	}

	draw() {
		// Calculate the dimensions of the graph, needed to take UI scaling into account
		this.calculateDimensions();

		// Clear any existing panels
		this.panels.grid.RemoveAndDeleteChildren();
		this.panels.graphContainer.RemoveAndDeleteChildren();

		// If either axis is undefined or 0 range we're gonna get Infinity/NaNs flying around everywhere
		if (
			!this.axis.every((axis) => !Number.isNaN(axis.min) && !Number.isNaN(axis.max)) ||
			this.axis[0].min === this.axis[0].max ||
			this.axis[1].min === this.axis[1].max
		) {
			$.Warning('LineGraph: Draw failed, data is invalid and will result in division by 0.');
			return;
		}

		// Loop through each axis and draw gridlines, axis names, and markers
		for (const [i, axisName] of ['x', 'y'].entries()) {
			const cp = $.GetContextPanel();
			const isX = i === 0;
			const axis = this.axis[i];
			const markers = cp.FindChildTraverse(axisName.toUpperCase() + 'Markers');

			// Set the name dialog var
			cp.SetDialogVariable(`linegraph_${axisName}`, axis.name);

			// Clear existing markers
			markers.RemoveAndDeleteChildren();

			const range = axis.max - axis.min;

			// Calculate the number of decimal places to give each label. If range > 10 just show the int, otherwise show a decimal places,
			// and add one for each trailing 0.
			const precision = Math.max(0, Math.ceil(1 - Math.log10(range)));

			const panelLength = isX ? this.width : this.height;

			const lineMin = Math.ceil(axis.min / axis.interval) * axis.interval;
			const lineMax = Math.floor(axis.max / axis.interval) * axis.interval;

			// Loop through all the gridlines and markers we want to draw
			for (let j = lineMin; j <= lineMax; j += axis.interval) {
				// Round out any floating point imprecision errors
				j = Number.parseFloat(j.toFixed(7));
				// Lerp for distance along the axis
				const dist = Math.round(((j - axis.min) / (axis.max - axis.min)) * panelLength);

				// String to pass to Panorama styling
				const offset = 'position: ' + (isX ? `${dist}px 0px 0px;` : `0px ${dist}px 0px;`);

				// Linear interpolate to determine marker text, backwards for Y. Then round to precision and cast back to Number.
				const markerValue = isX ? j : lineMax + lineMin - j;
				let markerValueStr = markerValue.toFixed(isX ? 0 : precision);
				if (axis.timeBased) {
					const extreme = Math.max(Math.abs(axis.min), Math.abs(axis.max));
					const time = Math.abs(markerValue);

					const sign = markerValue > 0 ? '+' : markerValue < 0 ? '-' : '';

					const hours = Math.floor(time / 3600);
					const minutes = Math.floor((time % 3600) / 60);
					const seconds = (time % 3600) % 60;

					let secondsStr = time < 10 && extreme < 10 ? seconds.toFixed(precision) : seconds.toString();
					let minuteStr = minutes.toString();

					markerValueStr = `${sign}${secondsStr}`;
					if (extreme >= 60) {
						if (extreme >= 3600 && minutes < 10) minuteStr = '0' + minuteStr;
						if (seconds < 10) secondsStr = '0' + secondsStr;
						markerValueStr =
							extreme >= 3600 ? `${sign}${hours}:${minuteStr}` : `${sign}${minuteStr}:${secondsStr}`;
					}
				}

				// Create the marker label
				$.CreatePanel('Label', markers, axisName + j, {
					class: 'linegraph__marker linegraph__marker--' + axisName,
					style: offset,
					text: markerValueStr
				});

				// Create the gridline, ignoring any that would sit on edge
				if (dist !== 0 && dist !== panelLength)
					$.CreatePanel('Panel', this.panels.grid, '', {
						// Add extra class for the line on the Y axis, if one sits there. Maybe a bit weird, could generalise in the future.
						class:
							'linegraph__gridline linegraph__gridline--' +
							axisName +
							(!isX && markerValue === 0 ? ' linegraph__gridline--axis' : ''),
						style: offset
					});
			}
		}

		// Create our lines!
		for (const [lineIndex, line] of this.lines.entries()) {
			const panel = $.CreatePanel('Panel', this.panels.graphContainer, `Graph${lineIndex}`);

			// Make a graph container, a canvas panel for the lines and a panel for the points.
			panel.LoadLayoutSnippet('graph-instance');

			const graph = panel.FindChild<UICanvas>('Graph');
			const pointsContainer = panel.FindChild('Points');

			if (!line.points) continue;

			// Array to send to the canvas
			const canvasPoints = [];

			// Loop through all the points in the class creating the panels for each, and generating an array of points in a format
			// that UICanvas likes.
			for (const point of line.points) {
				const id = point.id;
				// Get their relative positions on the graph panel
				const position = this.getRelativisedPosition(point);

				const size = point.selectionSize;
				const offset = size / 2;

				canvasPoints.push(position.x, position.y);

				// Outer panel, no styling, just to we attach events to
				const panel = $.CreatePanel('Panel', pointsContainer, id, {
					class: 'linegraph__point-wrapper',
					style: `position: ${position.x - offset}px ${position.y - offset}px 0px;
							width: ${size}px;
							height: ${size}px;`
				});

				// Inner panel, that actually displays the point.
				$.CreatePanel('Panel', panel, '', {
					class: 'linegraph__point ' + point?.class
				});

				// Register any events the point, binding the ID of the point panel in the first argument place.
				if (point.events)
					for (const [name, fn] of Object.entries(point.events))
						panel.SetPanelEvent(name, fn.bind(undefined, id));
			}

			// Draw the line on the canvas
			graph.DrawLinePoints(canvasPoints.length / 2, canvasPoints, line.thickness, line.color);

			// Draw shaded polygons in the areas above and below the line.
			// Drawing some single massive polygon with canvas is buggy so instead we pretty much integrate,
			// finding trapezoids and triangles between points and the axis. This was really fun!
			if (line.shadeAboveToOriginColor || line.shadeBelowToOriginColor) {
				// Array of points to fill up, then draw, then empty
				let polyPoints: Point[] = [];

				// Draw a polygon in the polyPoints array, then clear it
				const drawPoly = (isAbove: boolean) => {
					const formattedArray = [];
					for (const [i, _] of polyPoints.entries()) {
						const relativedPoints = this.getRelativisedPosition(
							polyPoints[isAbove ? i : polyPoints.length - i - 1]
						);
						formattedArray.push(relativedPoints.x, relativedPoints.y);
					}
					graph.DrawPoly(
						polyPoints.length,
						formattedArray,
						isAbove ? line.shadeAboveToOriginColor : line.shadeBelowToOriginColor
					);
					polyPoints = [];
				};

				// Search through all the space below or above the axis (comments are written for the "below" case)
				const findPoly = (isAbove: boolean, trackingBool: boolean) => {
					for (const [i, point] of line.points.entries()) {
						if (isAbove ? point.y > 0 : point.y < 0) {
							// If this point is below, the next iteration is going to be finishing a poly
							trackingBool = true;

							// Ignore 0 zero, next iteration handles it.
							if (i === 0) continue;

							const lastPoint = line.points[i - 1];
							if (isAbove ? lastPoint.y > 0 : lastPoint.y < 0) {
								// Last point ABOVE origin, so make a trapezoid.
								polyPoints.push({ x: lastPoint.x, y: 0 }, lastPoint, point, {
									x: point.x,
									y: 0
								});
							} else {
								// Previous point was somewhere BELOW the axis, so find point where line between last point and this one intersect the axis,
								// make a triangle between that point, current point, and current point's x at y = 0.
								const xIntersect =
									lastPoint.x - lastPoint.y * ((point.x - lastPoint.x) / (point.y - lastPoint.y));
								polyPoints.push({ x: xIntersect, y: 0 }, point, {
									x: point.x,
									y: 0
								});
							}
							drawPoly(isAbove);
						} else if (trackingBool) {
							// This point is above origin, but finish the polygon we started tracking in the last iteration, i.e. find where
							// line between this point and last intersect and make a triangle.
							trackingBool = false;
							const lastPoint = line.points[i - 1];
							const xIntersect = point.x - point.y * ((lastPoint.x - point.x) / (lastPoint.y - point.y));
							polyPoints.push(
								{ x: lastPoint.x, y: 0 },
								{ x: lastPoint.x, y: lastPoint.y },
								{ x: xIntersect, y: 0 }
							);
							drawPoly(isAbove);
						}
					}
				};

				const isDoingAbovePoly = false;
				const isDoingBelowPoly = false;

				if (line.shadeAboveToOriginColor) findPoly(true, isDoingAbovePoly);
				if (line.shadeBelowToOriginColor) findPoly(false, isDoingBelowPoly);
			}
		}
	}

	/** Update the dimensions of the panel, accounting for uiscale fuckery */
	calculateDimensions() {
		this.height = this.panels.graphContainer.actuallayoutheight / this.panels.graphContainer.actualuiscale_y;
		this.width = this.panels.graphContainer.actuallayoutwidth / this.panels.graphContainer.actualuiscale_x;
	}

	/** Find the location of point relative to the graph panel. */
	private getRelativisedPosition(point: Point): Point {
		// Linearly interpolate both components by the axis max and min
		const xLerp = (point.x - this.axis[0].min) / (this.axis[0].max - this.axis[0].min);
		const yLerp = (point.y - this.axis[1].min) / (this.axis[1].max - this.axis[1].min);

		// Scale them
		const x = xLerp * this.width;
		const y = (1 - yLerp) * this.height;

		return {
			x: x,
			y: y,
			class: point?.class,
			selectionSize: point?.selectionSize
		};
	}
}
