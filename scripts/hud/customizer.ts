// I'm trying something new here and using a namespace to escape the namespace pollution nightmare currently have
// In short, TypeScript seems to put stuff that doesn't include `import`/`export`s in the global namespace,
// and using those is impossible since pure V8 doesn't have an import/module system.

// The below `Axis` enum is breaking compiles because we have some fucking JSDOC (!) typedef in linegraph.js
// that overlaps with this one. So, I'm using a namespace (which just gets compiled to an IIFE for scope isolation)
// and not using a static class - that was essentially just playing the role of an IIFE anyway!

// Not sure if this is what we'll stick with it, but seems good for now.

namespace HudCustomizer {
	enum Axis {
		X = 0,
		Y = 1
	}

	const Axes = [Axis.X, Axis.Y] as const;

	type Snaps = [SnapMode, SnapMode];

	/**
	 * The four different snapping behaviours
	 * For a horizontal panel, min and max are left and right respectively, for vertical, top and bottom
	 */
	enum SnapMode {
		MIN = 1,
		MID = 2,
		MAX = 3,
		OFF = 4
	}

	const ResizeDirection = {
		TOP: 1,
		TOP_RIGHT: 2,
		RIGHT: 3,
		BOTTOM_RIGHT: 4,
		BOTTOM: 5,
		BOTTOM_LEFT: 6,
		LEFT: 7,
		TOP_LEFT: 8
	};

	// Tuple of X, Y axis snaps respectively
	const DEFAULT_SNAP_MODES: Snaps = [SnapMode.OFF, SnapMode.OFF];
	const DEFAULT_GRID_SIZE = 5;

	interface HudConfig {
		components: {
			[id: string]: {
				position: LayoutUtil.Position;
				snaps: [number, number];
			};
		};
		settings: {
			gridSize: number;
		};
	}

	interface Component {
		panel: Panel;
		snaps: Snaps;
		position: LayoutUtil.Position;
		properties?: Record<string, unknown>;
	}

	interface Gridline {
		panel: Panel;
		offset: number;
	}

	type GridlineForAxis = [Gridline[], Gridline[]];

	const snaps: Record<
		Axis,
		Record<
			SnapMode,
			{
				name: string;
				button: RadioButton;
				sizeFactor: number;
			}
		>
	> = {
		[Axis.X]: {
			[SnapMode.MIN]: {
				name: 'Left',
				button: $<RadioButton>('#HudCustomizerSnapsXMin')!,
				sizeFactor: 0
			},
			[SnapMode.MID]: {
				name: 'Center',
				button: $<RadioButton>('#HudCustomizerSnapsXMid')!,
				sizeFactor: 0.5
			},
			[SnapMode.MAX]: {
				name: 'Right',
				button: $<RadioButton>('#HudCustomizerSnapsXMax')!,
				sizeFactor: 1
			},
			[SnapMode.OFF]: {
				name: 'None',
				button: $<RadioButton>('#HudCustomizerSnapsXOff')!,
				sizeFactor: 0
			}
		},
		[Axis.Y]: {
			[SnapMode.MIN]: {
				name: 'Top',
				button: $<RadioButton>('#HudCustomizerSnapsYMin')!,
				sizeFactor: 0
			},
			[SnapMode.MID]: {
				name: 'Center',
				button: $<RadioButton>('#HudCustomizerSnapsYMid')!,
				sizeFactor: 0.5
			},
			[SnapMode.MAX]: {
				name: 'Bottom',
				button: $<RadioButton>('#HudCustomizerSnapsYMax')!,
				sizeFactor: 1
			},
			[SnapMode.OFF]: {
				name: 'None',
				button: $<RadioButton>('#HudCustomizerSnapsYOff')!,
				sizeFactor: 0
			}
		}
	};

	const panels = {
		customizer: $('#HudCustomizer')!,
		virtual: $('#HudCustomizerVirtual')!,
		virtualName: $<Label>('#HudCustomizerVirtualName')!,
		snaps: $('#HudCustomizerSnaps')!,
		grid: $('#HudCustomizerGrid')!,
		gridSize: $<NumberEntry>('#HudCustomizerGridSize')!,
		knobContainer: $('#HudCustomizerKnobContainer')!
	};

	let components: Record<string, Component>;
	let gridlines: GridlineForAxis;
	let activeComponent: Component | undefined;
	let activeGridlines: [Gridline | undefined, Gridline | undefined];
	let resizeKnobs: Record<keyof typeof ResizeDirection, Button>;

	let dragStartHandle: number | undefined;
	let dragEndHandle: number | undefined;
	let onThinkHandle: number | undefined;

	// TODO: Unused. Didn't get very far with resize stuff, behaviour should be
	// similar to dragging the virtual panel.
	let knobDragStartHandle: number | undefined;
	let knobDragEndHandle: number | undefined;
	let knobOnThinkHandle: number | undefined;

	let gridSize = 5;

	const scaleX = $.GetContextPanel().actualuiscale_x;
	const scaleY = $.GetContextPanel().actualuiscale_y;

	$.RegisterForUnhandledEvent('HudChat_Show', () => enableEditing());
	$.RegisterForUnhandledEvent('HudChat_Hide', () => disableEditing());

	function save() {
		const saveData: HudConfig = {
			settings: { gridSize: gridSize },
			components: {}
		};

		for (const [id, component] of Object.entries(components)) {
			const posX = fixFloatingImprecision(
				LayoutUtil.getX(component.panel) +
					LayoutUtil.getWidth(component.panel) * snaps[0][component.snaps[0]].sizeFactor
			);
			const posY = fixFloatingImprecision(
				LayoutUtil.getX(component.panel) +
					LayoutUtil.getHeight(component.panel) * snaps[1][component.snaps[1]].sizeFactor
			);

			saveData.components[id] = {
				position: [posX, posY],
				snaps: component.snaps
			};
		}

		HudCustomizerAPI.SaveLayoutFromJS(saveData);
	}

	function load() {
		gridlines = [[], []];
		activeGridlines = [undefined, undefined];
		activeComponent = undefined;

		let layoutData: HudConfig;
		try {
			layoutData = HudCustomizerAPI.GetLayout() as HudConfig;
		} catch {
			$.Warning('HudCustomizer: Failed to parse layout file!');
			return;
		}

		gridSize = layoutData?.settings?.gridSize ?? 5;
		panels.gridSize.value = gridSize;

		createGridLines();

		resizeKnobs = {} as any;
		Object.values(ResizeDirection)
			.filter((x) => !Number.isNaN(+x))
			.forEach((dir) => {
				resizeKnobs[dir] = $.CreatePanel('Button', panels.knobContainer, `Resize_${ResizeDirection[dir]}`, {
					class: 'hud-customizer__resize-knob',
					draggable: true,
					hittest: true
				});
			});

		components = {};
		$.GetContextPanel()
			.Children()
			.filter((panel) => panel.GetAttributeString('customizable', '') === 'true')
			.forEach((panel) => loadComponentPanel(layoutData?.components[panel.id], panel));
	}

	function loadComponentPanel(component: Pick<Component, 'position' | 'snaps'> | undefined, panel: Panel) {
		if (component) {
			for (const [i, snap] of component.snaps.entries()) {
				if (!Object.values(SnapMode).includes(snap)) {
					$.Warning(`HudCustomizer: Invalid snap values ${snap}, setting to default.`);
					component.snaps[i] = DEFAULT_SNAP_MODES[i];
				}
			}

			const layoutPos = component.position.map((len, i) => {
				if (Number.isNaN(len)) {
					$.Warning(`HudCustomizer: Loaded invalid position ${len}, setting to 0.`);
					len = 0;
				}

				const isX = i === 0;
				const max = isX ? 1920 : 1080;
				const sf = snaps[i][component.snaps[i]].sizeFactor;
				const panelLen = isX ? LayoutUtil.getWidth(panel) : LayoutUtil.getHeight(panel);
				let layoutLen = len - panelLen * sf;
				const maxOOB = 16;

				if (layoutLen < 0 && layoutLen + panelLen < maxOOB) {
					$.Warning(
						`HudCustomizer: Panel ${panel.id} is too far off-screen (X = ${layoutLen}), nudging on-screen.`
					);
					layoutLen = 0;
				} else if (layoutLen + panelLen > max - maxOOB) {
					$.Warning(
						`HudCustomizer: Panel ${panel.id} is too far off-screen (Y = ${layoutLen}), nudging on-screen.`
					);
					layoutLen = max - panelLen;
				}

				return layoutLen;
			}) as LayoutUtil.Position;

			LayoutUtil.setPosition(panel, layoutPos);

			components[panel.id] = {
				panel,
				...component
			};
		} else {
			const size = LayoutUtil.getSize(panel);

			if (
				size[0] > 1920 ||
				size[1] > 1080 ||
				(size[0] === 1920 && size[1] > 1080 / 2) ||
				(size[1] === 1080 && size[0] > 1920 / 2)
			) {
				$.Warning(
					`HudCustomizer: Found an unrecognised HUD panel ${panel.paneltype} with stupid big dimensions, ignoring.\n` +
						`\tWidth: ${size[0]}\tHeight: ${size[1]}` +
						`\tPosition: [${LayoutUtil.getPosition(panel).join(', ')}]).`
				);
				return;
			}

			// TODO: This approach isn't right. If the component wasn't found in hud.kv3, it's probably a new HUD
			// component that was added after the user first launched then closed the game, generating hud.kv3 for the
			// first time. So use the new HudCustomizerAPI.GetDefaultLayout and see if a matching component is in there,
			// and if it is, use those values. Only if it's not found in there should we do the below stuff.

			$.Msg(
				"HudCustomizer: Found a customizable HUD element that isn't stored, initialising with default values."
			);

			components[panel.id] = {
				panel,
				position: LayoutUtil.getPosition(panel),
				snaps: DEFAULT_SNAP_MODES
			};
		}
	}

	export function enableEditing() {
		// Onload calls load() too early so have to do this
		// TODO: I don't know why the above is the case, clearly shitty behaviour, fiugure it out!
		if (!components || Object.keys(components).length === 0) {
			load();
		}

		panels.customizer.AddClass('hud-customizer--enabled');

		for (const component of Object.values(components)) {
			component.panel.AddClass('hud-customizable');
			component.panel.SetPanelEvent('onmouseover', () => onComponentMouseOver(component));
		}
	}

	export function disableEditing() {
		panels.customizer.RemoveClass('hud-customizer--enabled');

		for (const component of Object.values(components)) {
			component.panel.RemoveClass('hud-customizable');
			component.panel.ClearPanelEvent('onmouseover');
		}

		$.UnregisterEventHandler('DragStart', panels.virtual, dragStartHandle);
	}

	function onComponentMouseOver(component: Component) {
		if (activeComponent && activeComponent === component) return;

		activeComponent?.panel.RemoveClass('hud-customizable--active');

		activeComponent = component;

		activeComponent.panel.AddClass('hud-customizable--active');

		const [[x, y], [width, height]] = LayoutUtil.getPositionAndSize(component.panel);

		// Set the virtual panel's position and size to the component we just hovered over
		LayoutUtil.setPositionAndSize(panels.virtual, [x, y], [width, height]);
		LayoutUtil.setPositionAndSize(panels.knobContainer, [x, y], [width, height]);

		const halfWidth = width / 2;
		const halfHeight = height / 2;
		let plusX, plusY;
		for (const [dir, knob] of Object.entries(resizeKnobs)) {
			switch (+dir) {
				case ResizeDirection.TOP:
					plusX = halfWidth;
					plusY = 0;
					break;
				case ResizeDirection.TOP_RIGHT:
					plusX = width;
					plusY = 0;
					break;
				case ResizeDirection.RIGHT:
					plusX = width;
					plusY = halfHeight;
					break;
				case ResizeDirection.BOTTOM_RIGHT:
					plusX = width;
					plusY = height;
					break;
				case ResizeDirection.BOTTOM:
					plusX = halfWidth;
					plusY = height;
					break;
				case ResizeDirection.BOTTOM_LEFT:
					plusX = 0;
					plusY = height;
					break;
				case ResizeDirection.LEFT:
					plusX = 0;
					plusY = halfHeight;
					break;
				case ResizeDirection.TOP_LEFT:
					plusX = 0;
					plusY = 0;
					break;
			}

			$.Msg({ x, y, width, height, dir, plusX, plusY });

			LayoutUtil.setPosition(knob, [plusX, plusY]);
		}

		// This is going to be weird to localise, but I guess we could do it, probably in V2 when we can
		// define the locale string in the `customisable` XML property.
		panels.virtualName.text = activeComponent.panel.id;
		// TODO: This text looks TERRIBLE. Better to just have a constant size text for every component
		// place text above component (left-aligned)
		const stupidFontSizeThing = Math.min(
			LayoutUtil.getHeight(activeComponent.panel) / 2,
			LayoutUtil.getWidth(activeComponent.panel) / 2
		);

		panels.virtualName.style.fontSize = stupidFontSizeThing;

		snaps[0][activeComponent.snaps[0]].button.SetSelected(true);
		snaps[1][activeComponent.snaps[1]].button.SetSelected(true); 

		if (dragStartHandle) {
			$.UnregisterEventHandler('DragStart', panels.virtual, dragStartHandle);
		}

		dragStartHandle = $.RegisterEventHandler('DragStart', panels.virtual, (...args) => onStartDrag(...args));
	}

	function onStartDrag(_source, callback) {
		if (!activeComponent) return;

		callback.displayPanel = panels.virtual;
		callback.removePositionBeforeDrop = false;

		// These aren't actually related to one-another in XML hierarchy so need to handle two classes
		activeComponent.panel.AddClass('hud-customizable--dragging');
		panels.virtual.AddClass('hud-customizer-virtual--dragging');

		$.UnregisterEventHandler('DragStart', panels.virtual, dragStartHandle);

		onThinkHandle = $.RegisterEventHandler('HudThink', $.GetContextPanel(), () => onDragThink());

		dragEndHandle = $.RegisterEventHandler('DragEnd', panels.virtual, () => onEndDrag());
	}

	function onDragThink() {
		if (!activeComponent) return;

		const oldPosition = [0, 0];
		const newPosition: LayoutUtil.Position = [0, 0];

		for (const axis of Axes) {
			const isX = axis === 0;

			if (activeComponent.snaps[axis] === SnapMode.OFF) {
				newPosition[axis] = isX ? LayoutUtil.getX(panels.virtual) : LayoutUtil.getY(panels.virtual);
			} else {
				const sizeFactor = snaps[axis][activeComponent.snaps[axis]].sizeFactor;

				const offset = isX
					? (activeComponent.panel.actuallayoutwidth * sizeFactor) / scaleX
					: (activeComponent.panel.actuallayoutheight * sizeFactor) / scaleY;

				const gridline = getNearestGridLine(axis, sizeFactor);
				const activeGridline = activeGridlines[axis];

				if (activeGridline) oldPosition[axis] = activeGridline.offset - offset;
				if (gridline) newPosition[axis] = gridline.offset - offset;

				if (gridline !== activeGridline) {
					if (activeGridline) activeGridline.panel.RemoveClass('hud-customizer__gridline--highlight');
					if (gridline) {
						gridline.panel.AddClass('hud-customizer__gridline--highlight');
						activeGridlines[axis] = gridline;

						newPosition[axis] = gridline.offset - offset;
					}
				}
			}
		}

		if (newPosition[0] !== oldPosition[1] || newPosition[1] !== oldPosition[1]) {
			LayoutUtil.setPosition(activeComponent.panel, newPosition);
			LayoutUtil.setPosition(panels.knobContainer, newPosition);
		}
	}

	function onEndDrag() {
		if (!activeComponent) return;

		$.UnregisterEventHandler('DragEnd', panels.virtual, dragEndHandle);
		$.UnregisterEventHandler('HudThink', $.GetContextPanel(), onThinkHandle);

		dragStartHandle = $.RegisterEventHandler('DragStart', panels.virtual, (...args) => onStartDrag(...args));

		dragEndHandle = undefined;
		onThinkHandle = undefined;

		activeComponent.panel.RemoveClass('hud-customizable--dragging');
		panels.virtual.RemoveClass('hud-customizer-virtual--dragging');

		LayoutUtil.copyPositionAndSize(activeComponent.panel, panels.virtual);

		activeGridlines?.forEach((line) => line?.panel.RemoveClass('hud-customizer__gridline--highlight'));

		activeGridlines = [undefined, undefined];

		// TODO: this is just for testing
		save();
	}

	function getNearestGridLine(axis: Axis, sizeFactor: number): Gridline {
		const isX = axis === Axis.X;

		const relativeOffset = isX
			? Math.max(
					0,
					Math.min(
						1920,
						(panels.virtual.actualxoffset + panels.virtual.actuallayoutwidth * sizeFactor) / scaleX
					)
			  )
			: Math.max(
					0,
					Math.min(
						1080,
						(panels.virtual.actualyoffset + panels.virtual.actuallayoutheight * sizeFactor) / scaleY
					)
			  );

		const glIndex = Math.round((relativeOffset / (isX ? 1920 : 1080)) * gridlines[axis].length);

		return gridlines[axis][glIndex];
	}

	function createGridLines(): void {
		panels.grid.RemoveAndDeleteChildren();

		const numXLines = 2 ** gridSize;
		const numYLines = Math.floor(numXLines * (9 / 16));

		gridlines = [[], []];
		activeGridlines = [undefined, undefined];

		for (const axis of Axes) {
			const isX = axis === 0;
			const numLines = isX ? numXLines : numYLines;
			const totalLength = isX ? 1920 : 1080;

			gridlines[axis] = Array.from({ length: numLines }, (_, i) => {
				const offset = totalLength * (i / numLines);

				let cssClass = `hud-customizer__gridline hud-customizer__gridline--${isX ? 'x' : 'y'}`;
				if (i === numLines / 2) cssClass += ' hud-customizer__gridline--mid';
				if (i === 0 || i === numLines) cssClass += 'hud-customizer__gridline--edge';

				const gridline = $.CreatePanel('Panel', panels.grid, '', { class: cssClass });

				LayoutUtil.setPosition(gridline, isX ? [offset, 0] : [0, offset]);

				return {
					panel: gridline,
					offset
				};
			});
		}
	}

	export function updateGridSize(): void {
		const newSize = panels.gridSize.value;

		if (newSize !== gridSize) {
			gridSize = newSize;
			createGridLines();
		} 
	}

	export function setSnapMode(axis: keyof Axis, mode: SnapMode): void {
		if (!activeComponent) return;

		activeComponent.snaps[axis] = mode;
		showSnapTooltip();
	}

	export function showSnapTooltip(): void {
		if (!activeComponent) return;

		UiToolkitAPI.ShowTextTooltip(
			panels.snaps.id,
			'<b><i>Snapping Mode</i></b>\n' +
				`Horizontal: <b>${snaps[0][activeComponent.snaps[0]].name}</b>\n` +
				`Vertical: <b>${snaps[1][activeComponent.snaps[1]].name}</b>`
		);
	}

	export function hideSnapTooltip(): void {
		UiToolkitAPI.HideTextTooltip();
	}

	function fixFloatingImprecision(n: number) {
		return +n.toPrecision(3);
	}
}
