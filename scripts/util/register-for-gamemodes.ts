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
 * @param panel - Panel context
 * @param callbackFn - Event callback
 * @returns Cleanup function that unregisters both event handlers
 */
export function RegisterEventForGamemodes(
	gamemodes: number[],
	event: keyof GlobalEventNameMap,
	panel: GenericPanel,
	callbackFn: (...args: unknown[]) => void
): () => void {
	let innerHandle: uuid | undefined;
	const outerHandle = $.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
		if (!innerHandle && gamemodes.includes(GameModeAPI.GetCurrentGameMode())) {
			innerHandle = $.RegisterEventHandler(event, panel, callbackFn);
		} else if (innerHandle) {
			$.UnregisterEventHandler(event, panel, innerHandle);
			innerHandle = undefined;
		}
	});

	return () => {
		if (innerHandle) {
			$.UnregisterEventHandler(event, panel, innerHandle);
		}

		$.UnregisterForUnhandledEvent('LevelInitPostEntity', outerHandle);
	};
}

// Could do RegisterUnhandledEventForGamemodes, just don't have a use for it.

export interface RegisterHUDPanelForGamemodeOptions {
	gamemodes: number[];
	onLoad?: Func;
	handledEvents?: Array<{ event: keyof GlobalEventNameMap; panel: GenericPanel; callback: Func }>;
	events?: Array<{ event: keyof GlobalEventNameMap; callback: Func }>;
}

/**
 * Mark a panel as being only active in the given gamemodes.
 *
 * The panel will be set to `visible=true` in the given modes, and `false` in all others.
 *
 * Any events provided will be registered at `LevelInitPostEntity` when the given a map is launched in the provided
 * modes, and unregistered in any other modes.
 *
 * An optional `onLoad` function will be called whenever a map is loaded in the provided modes.
 *
 * You must provide the current JS context with `context`, and don't need to use `.bind(this)` on any functions you pass.
 *
 * @example
 * // Simplest usage, only visible in SURF.
 * class MyEpicSurfPanel {
 *   static {
 *     RegisterHUDPanelForGamemode({
 *       gamemodes: [Gamemode.SURF],
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
 *        contextPanel: $.GetContextPanel(),
 *        onLoad: this.setup,
 *        events: [{
 *          event: 'HudProcessInput',
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
	onLoad,
	gamemodes,
	handledEvents,
	events
}: RegisterHUDPanelForGamemodeOptions): () => void {
	const contextPanel = $.GetContextPanel();

	if (!(gamemodes?.length > 0)) {
		throw new Error('RegisterHUDPanelForGamemode: no gamemode provided');
	}

	let handles: Array<{ event: keyof GlobalEventNameMap; handle: number; panel?: GenericPanel }> = [];

	const unregister = () =>
		handles.forEach(({ event, handle, panel }) =>
			panel ? $.UnregisterForUnhandledEvent(event, handle) : $.UnregisterEventHandler(event, panel, handle)
		);

	const handle = $.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
		unregister();
		handles = [];

		if (gamemodes.includes(GameModeAPI.GetCurrentGameMode())) {
			contextPanel.enabled = true;
			onLoad?.();

			events?.forEach(({ event, callback }) => {
				handles.push({
					event,
					handle: $.RegisterForUnhandledEvent(event, callback)
				});
			});

			handledEvents?.forEach(({ event, panel, callback }) => {
				handles.push({
					event,
					panel,
					handle: $.RegisterEventHandler(event, panel, callback)
				});
			});
		} else {
			contextPanel.enabled = false;
		}
	});

	return () => {
		unregister();
		$.UnregisterForUnhandledEvent('LevelInitPostEntity', handle);
	};
}
