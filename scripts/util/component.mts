interface Constructor<T = any> extends Function {
	new (...args: any[]): T;
}

// Tuple of event names, class methods, and whether the event is handled or not. If adding more entries, make
// a corresponding interface below so classes can explicitly mark that they are implementing one of these.
// We don't actually know if a class has marked itself with an `implements` at runtime, but it makes the system
// feel much less magic to explicitly do so.
const IMPLEMENTABLE_EVENTS: Array<
	[keyof GlobalEventNameMap | keyof PanelEventNameMap, string, true] | [keyof GlobalEventNameMap, string, false]
> = [
	['PanelLoaded', 'onLoaded', true],
	['LevelInitPostEntity', 'onMapLoad', false]
] as const;

/**
 * Register a `Component` method with the `PanelLoaded` panel event.
 * 
 * Any work that should done during panel initialization that involves child panels should be placed here, not
 * in this class's constructor; the constructor is called early in the panel init process, before child panels have 
 * been initialized.
 * 
 * Implementing this interface is equivalent to calling the following during the constructor:
 * ```ts
 * $.RegisterEventHandler('PanelLoaded', $.GetContextPanel(), () => this.onLoaded());
 * ```
 */
export interface OnLoad {
	onLoad(): void;
}

/**
 * Register a `Component` method with the `OnLevelInitPostEntity` event. Called whenever a map has reached the final 
 * stages of initializing.
 * 
 * Implementing this interface is equivalent to calling the following during the constructor:
 * ```ts
 * $.RegisterForUnhandledEvent('OnLevelInitPostEntity, () => this.onMapLoad());
 * ```
 */
export interface OnMapLoad {
	onMapLoad(): void;
}

/**
 * Class decorator for exposing a class with the context object of the current panel.
 * 
 * This allows modules, which otherwise live in an encapsulated JS context, to expose themselves to XML. It also avoids
 * the unintuitive process of making every member of a class `static`, since we actually instantiate an instance of the
 * given class.
 */
export function Component<Component extends object, Ctor extends Constructor<Component>>(target: Ctor) {
	const instance = new target();

	for (const [event, method, handled] of IMPLEMENTABLE_EVENTS) {
		if (method in instance) {
			handled
				? $.RegisterEventHandler(event, $.GetContextPanel(), instance[method].bind(instance))
				: $.RegisterForUnhandledEvent(event as keyof GlobalEventNameMap, instance[method].bind(instance));
		}
	}

	// Target is a ctor, so the function name is the class it's a constructor for. Look ma, no reflection!
	$.GetContextObject()[target.name] = instance;
}
