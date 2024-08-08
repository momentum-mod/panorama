/** Check whether a given argument is an Object. */
export function isObject(item: any): boolean {
	return item && typeof item === 'object' && !Array.isArray(item);
}

/** Deep merge two Objects. */
export function mergeDeep(target: object, source: object): object {
	if (!(isObject(target) && isObject(source))) {
		throw new Error('Both arguments must be objects.');
	}

	const output = Object.assign({}, target);
	for (const key of Object.keys(source)) {
		if (isObject(source[key])) {
			if (!(key in target)) Object.assign(output, { [key]: source[key] });
			else output[key] = mergeDeep(target[key], source[key]);
		} else {
			Object.assign(output, { [key]: source[key] });
		}
	}
	return output;
}

/** Deep compare two Objects. */
export function compareDeep(object1: object, object2: object): boolean {
	const objKeys1 = Object.keys(object1);
	const objKeys2 = Object.keys(object2);

	if (objKeys1.length !== objKeys2.length) return false;

	for (const key of objKeys1) {
		const value1 = object1[key];
		const value2 = object2[key];
		const isObjects = isObject(value1) && isObject(value2);

		if ((isObjects && !compareDeep(value1, value2)) || (!isObjects && value1 !== value2)) return false;
	}

	return true;
}

/**
 * Traverse all descendents of a Panel (depth-first). Use this to avoid ugly recursive search functions.
 * This is a generator iterator function, meaning it returns an iterable you can iterate over it directly with a
 * for...of loop.
 */
export function* traverseChildren(panel: GenericPanel): Generator<GenericPanel> {
	const stack = panel.Children();
	while (stack.length > 0) {
		const child = stack.pop();
		yield child;
		stack.push(...child.Children());
	}
}

/**
 * Pass an event that should be only registered when playing certain gamemodes.
 *
 * This function will register/unregister the provided events handler when gamemodes change.
 *
 * It returns a function that will clean up both event handlers. It's unlikely we'll ever need to use it,
 * so usually you can just discard it.
 *
 * @example
 * ```ts
 * // In the static initializer block for some panel's class, call the onUpdate function on this class
 * // whenever the 'HudProcessInput' event is fired, ONLY if the current gamemode is Gamemode.DEFRAG.
 * 	static {
 * 		RegisterEventForGamemodes(
 * 			[GameMode.DEFRAG],
 * 			'HudProcessInput',
 * 			$.GetContextPanel(),
 * 			this.onUpdate.bind(this)
 * 		);
 * 	}
 * ```
 * @param gamemodes - Gamemodes to register the callback for. Handler is unregistered for any other modes.
 * @param event - Event name
 * @param context - Panel context
 * @param callbackFn - Event callback
 * @returns Cleanup function that unregisters both event handlers
 */
export function RegisterEventForGamemodes(
	gamemodes: number[],
	event: keyof GlobalEventNameMap,
	context: GenericPanel,
	callbackFn: (...args: unknown[]) => void
): () => void {
	let innerHandle: uuid | undefined;
	const outerHandle = $.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
		if (!innerHandle && gamemodes.includes(GameModeAPI.GetCurrentGameMode())) {
			innerHandle = $.RegisterEventHandler(event, context, callbackFn);
		} else if (innerHandle) {
			$.UnregisterEventHandler(event, context, innerHandle);
			innerHandle = undefined;
		}
	});

	return () => {
		if (innerHandle) {
			$.UnregisterEventHandler(event, context, innerHandle);
		}

		$.UnregisterForUnhandledEvent('LevelInitPostEntity', outerHandle);
	};
}

export interface RegisterHUDPanelForGamemodeOptions {
	context: object;
	contextPanel: Panel;
	gamemodes: number[];
	onLoad?: Func;
	handledEvents?: Array<{ event: keyof GlobalEventNameMap; callback: Func; contextPanel: Panel }>;
	unhandledEvents?: Array<{ event: keyof GlobalEventNameMap; callback: Func }>;
}

/**
 * Mark a panel as being only active in the given gamemodes.
 *
 * The panel will be set to `visible=true` in the given modes, and `false` in all others.
 *
 * Any events provided will be registered at `LevelInitPostEntity` when the given a map is launched in the provided
 * modes, and unregistered in any other modes.
 *
 * An optional `onLoad` function will be called whenever a launched in the provided modes.
 *
 * You must provide the current JS context with `context`, and don't need to use `.bind(this)` on any functions you pass.
 *
 * @example
 * // Simplest usage, only visible in SURF.
 * class MyEpicSurfPanel {
 *   static {
 *     RegisterHUDPanelForGamemode({
 *       gamemodes: [Gamemode.SURF],
 *       context: this,
 *       contextPanel: $.GetContextPanel()
 *     })
 *   }
 * }
 *
 * // More advanced example.
 * class MyFuckedUpBhopPanel {
 *   static {
 *     RegisterHUDPanelForGamemode({
 *        gamemodes: [Gamemode.BHOP],
 *        context: this,
 *        contextPanel: $.GetContextPanel(),
 *        onLoad: this.setup,
 *        handledEvents: [{
 *          event: 'HudProcessInput',
 *          callback: this.onUpdate,
 *          contextPanel: $.GetContextPanel()
 *        }]
 *     })
 *   }
 *
 *   static setup() {
 *     // ...
 *   }
 *
 *   static onUpdate() {
 *     // ...
 *   }
 * }
 *
 * @returns Cleanup function that unregisters all event handlers
 */
export function RegisterHUDPanelForGamemode({
	context,
	contextPanel,
	onLoad,
	gamemodes,
	handledEvents,
	unhandledEvents
}: RegisterHUDPanelForGamemodeOptions): () => void {
	if (!(gamemodes?.length > 0)) {
		throw new Error('RegisterHUDPanelForGamemode: no gamemode provided');
	}

	let handles: Array<{ event: keyof GlobalEventNameMap; handle: number; contextPanel?: GenericPanel }>;

	const unregister = () =>
		(handles ?? []).forEach(({ event, handle, contextPanel }) =>
			contextPanel === undefined
				? $.UnregisterForUnhandledEvent(event, handle)
				: $.UnregisterEventHandler(event, contextPanel, handle)
		);

	const handle = $.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
		unregister();
		handles = [];

		if (gamemodes.includes(GameModeAPI.GetCurrentGameMode())) {
			contextPanel.enabled = true;
			onLoad?.call(context);

			for (const { event, callback } of unhandledEvents ?? []) {
				handles.push({
					event,
					handle: $.RegisterForUnhandledEvent(event, callback.bind(context))
				});
			}

			for (const { event, contextPanel, callback } of handledEvents ?? []) {
				handles.push({
					event,
					contextPanel,
					handle: $.RegisterEventHandler(event, contextPanel, callback.bind(context))
				});
			}
		} else {
			contextPanel.enabled = false;
		}
	});

	return () => {
		unregister();
		$.UnregisterForUnhandledEvent('LevelInitPostEntity', handle);
	};
}
