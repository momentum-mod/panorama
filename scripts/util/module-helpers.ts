/* eslint-disable @typescript-eslint/no-unsafe-function-type */

/**
 * Expose the given properties to the panel context. This allows XML event handlers to access objects declared in
 * modules as if they were declared in a script (.js rather than  file).
 *
 * Takes an object as argument, passing a propery with key `K` and value `V` is the same as declaring a variable with
 * name `K` and value `V` inside of a script.
 *
 * Say you have some TS code (in a module):
 * ```ts
 * enum State {
 *   ON,
 *   OFF
 * }
 *
 * let lightbulb = State.OFF
 *
 * function setState(state: State) {
 *   lightbulb = state;
 * }
 * ```
 * and XML:
 * ```xml
 * <Button onactivate="setState(State.ON)" />
 * ```
 *
 * To expose these, add `exposeToPanelContext({ State, setState });` at the bottom of the TS file. Note the object
 * shorthand, that `{ State }` is shorthand to `{ State: State }`, skipping writing`State`/`setState` twice).
 */
export function exposeToPanelContext(obj: Record<string, any>): void {
	Object.assign($.GetContextObject(), obj);
}

/**
 * Class decorator for exposing a class in a module to the current panel context.
 *
 * This allows modules, which otherwise live in an encapsulated JS context, to expose themselves to XML.
 *
 * It also avoids the unintuitive process of making every member of a class `static`, since we actually instantiate an
 * instance of the given class. Applying `@PanelHandler` effectively creates a singleton of the class it's applied to.
 * If needed by TS code outside of that class, but within the same panel context, you can use
 * `getHandlerInstance(<ClassName>)` to get the instance.
 *
 * Alternatively, you can provide `{ static: true }`, and apply to a class with static fields/methods, more akin to our
 * old setup. Other TS code in that *file* can then safely access static members of class.
 *
 * The `name` option can be provided to override the name of the class when exposed to panel context (otherwise defaults
 * to the name of the class.
 *
 * The `exposeToPanel` option will assign the handler instance to the current context's *panel* object, i.e. the
 * outermost panel the module is defined in, the return value of `$.GetContextPanel`. This allows accessing the instance
 * from other panels in the DOM, which is a much more convenient way for panels to communicate than events. By default
 * the exposed property is called `handler`, it can be overriden using the `exposeToPanelAs` field (note that setting
 * `exposeToPanelAs` implicitly applies `exploseToPanel). For an example of this in action, see how player-card.ts interacts
 * with level-indicator.ts.
 *
 * @example
 * For this class, when this module is first loaded, `@PanelHandler` will *immediately*
 * - Construct an instance of `FooHandler` ('Instantiated' is printed)
 * - Assign the instance to the `FooHandler` property of the current panel context
 *   - This allows XML to register e.g. `onactivate="FooHandler.onButtonPressed()"`
 * - Register to onPanelLoad method with the 'PanelLoaded' panel event ('Panel Loaded' is printed when panel load is finished)
 * ```ts
 * @PanelHandler()
 * class FooHandler implements OnPanelLoad {
 *   constructor() {
 *     $.Msg('Instantiated');
 *   }
 *
 *   onPanelLoad() {
 *     $.Msg('Panel loaded');
 *   }
 *
 *   onButtonPressed() {
 *     $.Msg('Button pressed');
 *   }
 * }
 * ```
 */
export function PanelHandler(
	opts: {
		static?: boolean;
		name?: string;
		exposeToPanel?: boolean;
		exposeToPanelAs?: string;
	} = {}
): ClassDecorator {
	return (target: Function): void => {
		// target is a ctor, so the function name is the class it's a constructor for. Look ma, no reflection!
		const className = opts.name ?? target.name;

		const contextObject = $.GetContextObject();

		// Only ever construct one instance
		if (className in contextObject) {
			return;
		}

		// If `static: true` is provided, don't create an instance, just assign the constructor itself, by which static
		// members are accessed (js is weird)
		const instance = opts.static === true ? target : new (target as Constructor)();

		// Assign to context object, exposing to XML
		contextObject[className] = instance;

		// Optionally expose to context panel object
		if (opts.exposeToPanel === true || opts.exposeToPanelAs) {
			$.GetContextPanel<any>()[opts.exposeToPanelAs ?? 'handler'] = instance;
		}

		// Register lifecycle stuff. We could add more events if we wanted, but we're never going to handle *all*
		// event registration this way, and I'd rather not have two competing approaches to event registration, besides
		// PanelLoaded for which this system is drastically better. Note that Panorama doesn't have a `PanelDestroyed` event or
		// similar.
		if ('onPanelLoad' in instance) {
			$.RegisterEventHandler('PanelLoaded', $.GetContextPanel(), instance['onPanelLoad'].bind(instance));
		}
	};
}

/**
 * Get the handler instance for a given handler class. You can use this to access the instance from other code in the
 * same TS file, or other modules with the same panel context.
 *
 * If you register a panel with @PanelHandler you NEED to call this to get the instance of the handler; handlers are
 * no longer static and are instantiated by the PanelHandler decorator.
 * @see PanelHandler
 */
export function getHandlerInstance<T extends Constructor>(handler: T): InstanceType<T> {
	const contextObject = $.GetContextObject();

	if (!(handler.name in contextObject)) {
		throw new Error(`Handler ${handler.name} not found in context object`);
	}

	return contextObject[handler.name];
}

/**
 * Create a new panel with additional JS properties assign to the created panel's JS object.
 *
 * Traditionally in Panorama if you want to assign additional properties to a panel you set
 * attributes, however these can only be strings or ints, and are more cumbersome to work
 * with in JS/TS. You can assign these in the third param of $.CreatePanel, but Panorama
 * will automatically stringify them.
 *
 * Instead we just assign JS properties to the panel object directly. Maybe a bit hacky, but
 * fine so long as the properties are documented in the declaration of the panel's type in
 * TypeScript.
 *
 * Previously we used Object.assign directly but this function provides strong type safety.
 */
export function createPanelExtended<T extends keyof PanelTagNameMap>(
	type: T,
	parent: GenericPanel,
	id: string,
	properties: Record<string, any>,
	additionalProperties: Partial<Omit<PanelTagNameMap[T], keyof Panel>>
) {
	const panel = $.CreatePanel(type, parent, id, properties);
	Object.assign(panel, additionalProperties);
	return panel;
}

/**
 * Register a `Component` method with the `PanelLoaded` panel event.
 *
 * Any work that should be done during panel initialization that involves child panels should be placed here, not
 * in this class's constructor - the constructor is called early in the panel init process, before child panels have
 * been initialized.
 *
 * Implementing this interface is equivalent to calling the following in the constructor:
 * ```ts
 * $.RegisterEventHandler('PanelLoaded', $.GetContextPanel(), () => this.onPanelLoad());
 * ```
 */
export interface OnPanelLoad {
	onPanelLoad(): void | Promise<void>;
}

export interface Constructor<T = any> extends Function {
	new (...args: any[]): T;
}
