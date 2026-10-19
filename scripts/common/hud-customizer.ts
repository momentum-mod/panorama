import { rgbaStringToTuple } from 'util/colors';

/**
 * Gets the HUD customizer handler instance.
 * Returns undefined if not initted. Be careful to check whether panel has been initialized yet.
 */
export function getHudCustomizer(): IHudCustomizerHandler | undefined {
	return UiToolkitAPI.GetGlobalObject()['HudCustomizerHandler'] as IHudCustomizerHandler;
}

/** Register a panel to be handled by the HUD customizer. */
export function registerHUDCustomizerComponent(panel: GenericPanel, properties: CustomizerComponentProperties): void {
	$.RegisterForUnhandledEvent('HudCustomizer_Ready', () => getHudCustomizer()!.loadComponent(panel, properties));
}

export enum CustomizerPropertyType {
	NONE,
	NUMBER_ENTRY,
	CHECKBOX,
	SLIDER,
	DROPDOWN,
	COLOR_PICKER,
	GRADIENT_PICKER,
	FONT_PICKER,
	NUMBER_LIST
}

interface PropertyTypeMap {
	[CustomizerPropertyType.NONE]: never;
	[CustomizerPropertyType.NUMBER_ENTRY]: NumberEntry;
	[CustomizerPropertyType.CHECKBOX]: ToggleButton;
	[CustomizerPropertyType.SLIDER]: Slider;
	[CustomizerPropertyType.DROPDOWN]: DropDown;
	[CustomizerPropertyType.COLOR_PICKER]: never;
	[CustomizerPropertyType.GRADIENT_PICKER]: never;
	[CustomizerPropertyType.FONT_PICKER]: never;
	[CustomizerPropertyType.NUMBER_LIST]: NumberEntry;
}

interface PropertyTypeToValueTypeMap {
	[CustomizerPropertyType.NONE]: null;
	[CustomizerPropertyType.NUMBER_ENTRY]: NumberEntry['value'];
	[CustomizerPropertyType.CHECKBOX]: ToggleButton['checked'];
	[CustomizerPropertyType.SLIDER]: Slider['value'];
	[CustomizerPropertyType.DROPDOWN]: string;
	[CustomizerPropertyType.COLOR_PICKER]: TextEntry['text'];
	[CustomizerPropertyType.GRADIENT_PICKER]: [string, string];
	[CustomizerPropertyType.FONT_PICKER]: string;
	[CustomizerPropertyType.NUMBER_LIST]: number[];
}

interface DynamicStyleChild {
	styleID: StyleID;
	showWhen?: any | any[];
}

export type StyleID = string;

export type QuerySelector = `#${string}` | `.${string}` | keyof PanelTagNameMap;

export type CallbackProps<PropertyType extends CustomizerPropertyType> =
	| {
			callbackFunc?: never;
			onChanged?: never;
	  }
	| {
			/**
			 * Callback that's called with every matching panel, and the current style value.
			 *
			 * Called on initialization and whenever style changes **before** {@link onChanged}
			 *
			 * If a change **should not happen during initialization** it should be moved to {@link onChanged}
			 */
			callbackFunc: (panel: GenericPanel, value: PropertyTypeToValueTypeMap[PropertyType]) => void;

			/**
			 * Callback that's called only once, when a style value value **after {@link callbackFunc}
			 *
			 * @see {@link callbackFunc}
			 */
			onChanged?: (value: PropertyTypeToValueTypeMap[PropertyType]) => void;
	  };

export type DynamicStyleProperties<
	PropertyType extends CustomizerPropertyType = CustomizerPropertyType,
	StyleProperty extends keyof Style | undefined = undefined
> = {
	/** Name of the property to display in UI. Please localize! */
	name: string;

	/** Tooltip shown while hovering the setting's row. Please localize! */
	tooltip?: string;

	/** Defines which styles should be the children of this style.
	 *
	 * styleID: id of the child
	 *
	 * showWhen: value of the parent
	 *
	 * When parent's value is the value defined in showWhen the child will be visible
	 *
	 * If showWhen is not provided the child is always visible unless hidden by the expandable property
	 */
	children?: DynamicStyleChild | DynamicStyleChild[];

	/**
	 * When true, the style can be manually expanded to show it's children, otherwise children are only shown through showWhen property */
	expandable?: boolean;

	/**
	 * Selector or array of selectors.
	 *
	 * Prefix # for ID, . for class, same as JSDollarSign.
	 *
	 * If not provided, applies to the root panel of the component.
	 */
	targetPanel?: QuerySelector | QuerySelector[];

	/** Type of UI for the customizer to generate to modify this style. */
	type: PropertyType;

	/**
	 * Defines options and their respective values for CustomizerPropertyType.DROPDOWN */
	options?: PropertyType extends CustomizerPropertyType.DROPDOWN ? Array<{ label: string; value: string }> : never;

	/**
	 * Defines the number entries of each item for CustomizerPropertyType.NUMBER_LIST. The value is a flat list holding
	 * every item's fields one after another. */
	listFields?: PropertyType extends CustomizerPropertyType.NUMBER_LIST
		? Array<{ name: string; min: number; max: number; default?: number }>
		: never;

	/**
	 * Labels for CustomizerPropertyType.NUMBER_LIST: an item in the selector (%n% is its number), the selector's entry
	 * that adds an item, its entry when there are none, and the button that deletes the selected item. Please localize! */
	listLabels?: PropertyType extends CustomizerPropertyType.NUMBER_LIST
		? { item: string; add: string; none: string; delete: string }
		: never;

	/**
	 * Style property to modify. For all matching panels, this CSS property is set to the current style value.
	 * Should at least supply this, callbackFunc, or eventlisteners (todo: maybe more stuff) */
	styleProperty?: StyleProperty;

	/**
	 * Function to convert stored/configured value to style string.
	 * IMPORTANT: This defaults to the identity function. If you're mapping a number, you need to do
	 * appropriate conversion to string with units here! E.g. (value) => `${value}px`.
	 * @default identity function
	 */
	valueFn?: (
		value: PropertyTypeToValueTypeMap[PropertyType]
	) => StyleProperty extends keyof Style ? Style[StyleProperty] : never;

	/**
	 * Collection properties to apply to generated panel, e.g. min/max on numberentry.
	 * Must be properties unique to that panel type.
	 */
	settingProps?: {
		[K in keyof PropertyTypeMap[PropertyType]]?: K extends keyof GenericPanel
			? never
			: PropertyTypeMap[PropertyType][K] extends (...args: any) => any
				? never
				: PropertyTypeMap[PropertyType][K];
	};

	/**
	 * Collection of events to register on a provided panel. When the event fires, the callback is called with the
	 * current style value, followed by the arguments the event was called with.
	 *
	 * Use this to set styles on panels that are generated *after* style values have initially been seen, e.g.
	 * incoming chat messages.
	 */
	events?: Array<
		{
			[K in keyof GlobalEventNameMap]: {
				event: K;
				panel: GenericPanel;
				callback: (
					value: PropertyTypeToValueTypeMap[PropertyType],
					...args: Parameters<GlobalEventNameMap[K]>
				) => void;
			};
		}[keyof GlobalEventNameMap]
	>;

	/**
	 * Collection of unhandled events to register. When the event fires, the callback is called with the
	 * current style value, followed by the arguments the event was called with.
	 
	 * Use this to set styles on panels that are generated *after* style values have initially been seen, e.g.
	 * incoming chat messages.
	 */
	unhandledEvents?: Array<
		{
			[K in keyof GlobalEventNameMap]: {
				event: K;
				callback: (
					value: PropertyTypeToValueTypeMap[PropertyType],
					...args: Parameters<GlobalEventNameMap[K]>
				) => void;
			};
		}[keyof GlobalEventNameMap]
	>;
} & CallbackProps<PropertyType>;

type MappedStyles = Record<
	StyleID,
	{
		[K in CustomizerPropertyType]: {
			[P in keyof Style]: DynamicStyleProperties<K, P>;
		}[keyof Style];
	}[CustomizerPropertyType]
>;

type HandledEventRegistration = {
	[K in keyof GlobalEventNameMap]: {
		event: K;
		panel: GenericPanel;
		callbackFn: GlobalEventNameMap[K];
	};
}[keyof GlobalEventNameMap];

type UnhandledEventRegistration = {
	[K in keyof GlobalEventNameMap]: {
		event: K;
		callbackFn: GlobalEventNameMap[K];
	};
}[keyof GlobalEventNameMap];

export interface CustomizerComponentProperties {
	/** Name of the panel to be displayed in hud customizer */
	name: string;

	/** Description shown while hovering the component's name in its settings. Please localize! */
	description?: string;

	/** Allow resizing in the X direction. */
	resizeX: boolean;

	/** Allow resizing in the Y direction. */
	resizeY: boolean;

	/**
	 * Number entry dynamic style the component's height comes from, for components that size themselves from a
	 * setting. Resizing sets it to the height divided by scale (default 1), and setting it resizes the component.
	 * A scale function is read again whenever any of the component's settings changes.
	 */
	heightStyle?: { styleID: string; scale?: number | (() => number) };

	/** Resize from the corner handles only, for components whose size setting scales them evenly. */
	resizeCorners?: boolean;

	/** Allow movement on X axis. Defaults to true */
	moveX?: boolean;

	/** Allow movement on Y axis. Defaults to true */
	moveY?: boolean;

	/** A collection of handled events to register */
	events?: HandledEventRegistration | Array<HandledEventRegistration>;

	/** A collection of unhandled events to register */
	unhandledEvents?: UnhandledEventRegistration | Array<UnhandledEventRegistration>;

	/** Defines in which gamemodes the panel should be enabled. When not provided it's always enabled */
	gamemode?: Gamemode | Gamemode[];

	/** Panel to use as the drag handle for moving the component. If not provided, whole panel is draggable. */
	dragPanel?: GenericPanel;

	/** Allow disabling the panel. Defaults to true */
	canDisable?: boolean;

	/**
	 * Expected minimum width of a component once it's been layed out in edit mode.
	 *
	 * This is for when layouting in edit mode can take multiple frames (currently happening with Comparisons).
	 * If provided, customizer will listen to the HudThink event and wait until the panel's width is at least
	 * this value so it can position the overlay panel correctly.
	 *
	 * If layouting takes more than 500 frames, we give up and just use whatever size the panel is at.
	 */
	expectedMinWidth?: number;

	/** @see expectedMinWidth */
	expectedMinHeight?: number;

	/** Styling properties of provided panel or children, for which we generate UI and store values for. */
	dynamicStyles?: MappedStyles;

	/** Runs once, after all {@link dynamicStyles} have been initialized */
	postInit?: () => void;
}

export interface IHudCustomizerHandler {
	/** Open or close the HUD customizer UI. */
	toggle(enable: boolean): void;

	/** Whether the HUD customizer edit UI is open. */
	isOpen(): boolean;

	/** Whether this component's panel is the one selected for editing. */
	isActiveComponent(panel: GenericPanel): boolean;

	/**
	 * Load a customizable HUD component.
	 * Must be after HudCustomizer_Ready has fired!
	 */
	loadComponent(panel: GenericPanel, properties: CustomizerComponentProperties): void;
}

/** Almost all hud panels use fast text shadow on fonts that is black with some adjusted alpha
 * This function is used to scale text shadow's alpha to font color alpha chosen for the player
 * In the future we might add text shadow configuration to hud customizer, for now this is the workaround
 */
export function getTextShadowFast(color: rgbaColor, multiplier: number): string {
	const alpha = rgbaStringToTuple(color)[3] / 255;
	return `0px 1px 1.5px 1 rgba(0, 0, 0, ${alpha * multiplier})`;
}
