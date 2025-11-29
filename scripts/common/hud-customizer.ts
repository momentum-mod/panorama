// TODO: *VERY* detailed docs here, the types are unreadable!

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
	NUMBER_ENTRY,
	CHECKBOX,
	SLIDER, // TODO: do we actually want this for anything?
	COLOR_PICKER,
	FONT_PICKER
}

interface PropertyTypeMap {
	[CustomizerPropertyType.NUMBER_ENTRY]: NumberEntry;
	[CustomizerPropertyType.CHECKBOX]: ToggleButton;
	[CustomizerPropertyType.SLIDER]: Slider;
	[CustomizerPropertyType.COLOR_PICKER]: never;
	[CustomizerPropertyType.FONT_PICKER]: never;
}

interface PropertyTypeToValueTypeMap {
	[CustomizerPropertyType.NUMBER_ENTRY]: NumberEntry['value'];
	[CustomizerPropertyType.CHECKBOX]: ToggleButton['checked'];
	[CustomizerPropertyType.SLIDER]: Slider['value'];
	[CustomizerPropertyType.COLOR_PICKER]: TextEntry['text'];
	[CustomizerPropertyType.FONT_PICKER]: string;
}

export type StyleID = string;

export type QuerySelector = `#${string}` | `.${string}` | keyof PanelTagNameMap;

export interface DynamicStyleProperties<
	PropertyType extends CustomizerPropertyType = CustomizerPropertyType,
	StyleProperty extends keyof Style | undefined = undefined
> {
	/** Name of the property to display in UI. Please localize! */
	name: string;

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
	 * Callback that's called with every matching panel, and the current style value.
	 *
	 * This gives you the ability to style whatever you want using JS, including capturing
	 * the component's handler class. Use with care!
	 */
	callbackFunc?: (panel: GenericPanel, value: PropertyTypeToValueTypeMap[PropertyType]) => void;

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
}

type MappedStyles = Record<
	StyleID,
	{
		[K in CustomizerPropertyType]: {
			[P in keyof Style]: DynamicStyleProperties<K, P>;
		}[keyof Style];
	}[CustomizerPropertyType]
>;

export interface CustomizerComponentProperties {
	/** Allow resizing in the X direction. */
	resizeX: boolean;

	/** Allow resizing in the Y direction. */
	resizeY: boolean;

	/** Panel to use as the drag handle for moving the component. If not provided, whole panel is draggable. */
	dragPanel?: GenericPanel;

	// TODO: impl me. don't let people disable the settings menu lol
	canDisabled?: boolean;

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
}

export interface IHudCustomizerHandler {
	/** Open or close the HUD customizer UI. */
	toggle(enable: boolean): void;

	/** Whether the HUD customizer edit UI is open. */
	isOpen(): boolean;

	/**
	 * Load a customizable HUD component.
	 * Must be after HudCustomizer_Ready has fired!
	 */
	loadComponent(panel: GenericPanel, properties: CustomizerComponentProperties): void;
}

export const MarginStyles = {
	marginTop: {
		name: 'Margin Top',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'marginTop',
		valueFn: (value) => `${value}px`
	},
	marginBottom: {
		name: 'Margin Bottom',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'marginBottom',
		valueFn: (value) => `${value}px`
	},
	marginLeft: {
		name: 'Margin Left',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'marginLeft',
		valueFn: (value) => `${value}px`
	},
	marginRight: {
		name: 'Margin Right',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'marginRight',
		valueFn: (value) => `${value}px`
	}
} satisfies MappedStyles;

export const PaddingStyles = {
	paddingTop: {
		name: 'Padding Top',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'paddingTop',
		valueFn: (value) => `${value}px`
	},
	paddingBottom: {
		name: 'Padding Bottom',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'paddingBottom',
		valueFn: (value) => `${value}px`
	},
	paddingLeft: {
		name: 'Padding Left',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'paddingLeft',
		valueFn: (value) => `${value}px`
	},
	paddingRight: {
		name: 'Padding Right',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'paddingRight',
		valueFn: (value) => `${value}px`
	}
} satisfies MappedStyles;

export const BackgroundColorStyle = {
	backgroundColor: {
		name: 'Background Color',
		type: CustomizerPropertyType.COLOR_PICKER,
		styleProperty: 'backgroundColor'
	}
} satisfies MappedStyles;

export const BorderStyles = {
	borderRadius: {
		name: 'Border Radius',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'borderRadius',
		valueFn: (value) => `${value}px`
	},
	borderWidthTop: {
		name: 'Border Top Width',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'borderTopWidth',
		valueFn: (value) => `${value}px`
	},
	borderWidthBottom: {
		name: 'Border Bottom Width',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'borderBottomWidth',
		valueFn: (value) => `${value}px`
	},
	borderWidthLeft: {
		name: 'Border Left Width',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'borderLeftWidth',
		valueFn: (value) => `${value}px`
	},
	borderWidthRight: {
		name: 'Border Right Width',
		type: CustomizerPropertyType.NUMBER_ENTRY,
		styleProperty: 'borderRightWidth',
		valueFn: (value) => `${value}px`
	},
	borderColor: {
		name: 'Border Color',
		type: CustomizerPropertyType.COLOR_PICKER,
		styleProperty: 'borderColor'
	}
} satisfies MappedStyles;
