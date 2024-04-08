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
function RegisterEventForGamemodes(
	gamemodes: number[],
	event: string,
	context: string | Panel,
	callbackFn: (...args: unknown[]) => void
): () => void {
	let innerHandle: number | undefined;
	const outerHandle = $.RegisterForUnhandledEvent('LevelInitPostEntity', () => {
		// @ts-expect-error - TODO: Typings for this API
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
