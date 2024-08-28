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
 * 			() => this.onUpdate()
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

	let handles: Array<{ event: keyof GlobalEventNameMap; handle: number; contextPanel?: GenericPanel }> = [];

	const unregister = () =>
		handles.forEach(({ event, handle, contextPanel }) =>
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
