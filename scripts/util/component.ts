// eslint-disable-next-line @typescript-eslint/ban-types
interface Constructor<T = any> extends Function {
	new (...args: any[]): T;
}

/**
 * Class decorator for exposing a class with the context object of the current panel.
 *
 * This allows modules, which otherwise live in an encapsulated JS context, to expose themselves to XML. It also avoids
 * the unintuitive process of making every member of a class `static`, since we actually instantiate an instance of the
 * given class.
 */
export function Component<Component extends object, Ctor extends Constructor<Component>>(target: Ctor): void {
	registerComponent(target, false);
}

/**
 * A `Component` which attaches its instance to the panel object of the current panel. This allows other components
 * to access the component class via `<panel>.jsClass` - use with care!
 * @see Component
 */
export function ExposedComponent<Component extends object, Ctor extends Constructor<Component>>(target: Ctor) {
	registerComponent(target, true);
}

function registerComponent<Component extends object, Ctor extends Constructor<Component>>(
	target: Ctor,
	exposed: boolean
) {
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

	if (exposed) {
		$.GetContextPanel<any>().jsClass = instance;
	}
}

// Tuple of event names, class methods, and whether the event is handled or not. If adding more entries, make
// a corresponding interface below so classes can explicitly mark that they are implementing one of these.
// We don't actually know if a class has marked itself with an `implements` at runtime, but it makes the system
// feel much less magic to explicitly do so.
const IMPLEMENTABLE_EVENTS: Array<
	[keyof GlobalEventNameMap | keyof PanelEventNameMap, string, true] | [keyof GlobalEventNameMap, string, false]
> = [
	['PanelLoaded', 'onLoaded', true],
	['LevelInitPostEntity', 'onMapLoad', false],
	['HudProcessInput', 'onHudUpdate', true]
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
export interface OnPanelLoad {
	onPanelLoad(): void;
}

/**
 * Register a `Component` method with the `LevelInitPostEntity` event. Called whenever a map has reached the final
 * stages of initializing.
 *
 * Implementing this interface is equivalent to calling the following during the constructor:
 * ```ts
 * $.RegisterForUnhandledEvent('LevelInitPostEntity, () => this.onMapLoad());
 * ```
 */
export interface OnMapLoad {
	onMapLoad(): void;
}

/**
 * Register a `Component` method with the `HudProcessInput` event. Called every time the HUD is preparing to re-paint.
 *
 * Implementing this interface is equivalent to calling the following during the constructor:
 * ```ts
 * $.RegisterForUnhandledEvent('HudProcessInput, () => this.onHudUpdate());
 * ```
 */
export interface OnHudUpdate {
	onHudUpdate(): void;
}
