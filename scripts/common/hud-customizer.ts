// TODO: *VERY* detailed docs here, the types are unreadable!

export enum CustomizerPropertyType {
	NUMBER_ENTRY,
	CHECKBOX,
	SLIDER,
	COLOR_PICKER
}

interface PropertyTypeMap {
	[CustomizerPropertyType.NUMBER_ENTRY]: NumberEntry;
	[CustomizerPropertyType.CHECKBOX]: ToggleButton;
	[CustomizerPropertyType.SLIDER]: Slider;
	[CustomizerPropertyType.COLOR_PICKER]: never;
}

interface PropertyTypeToValueTypeMap {
	[CustomizerPropertyType.NUMBER_ENTRY]: NumberEntry['value'];
	[CustomizerPropertyType.CHECKBOX]: ToggleButton['checked'];
	[CustomizerPropertyType.SLIDER]: Slider['value'];
	[CustomizerPropertyType.COLOR_PICKER]: TextEntry['text'];
}

export type QuerySelector = `#${string}` | `.${string}`;

interface DynamicStyleBase<PropertyType extends CustomizerPropertyType> {
	/**
	 * Selector or array of selectors.
	 *
	 * Prefix # for ID, . for class, same as JSDollarSign.
	 *
	 * If not provided, applies to the root panel of the component.
	 */
	targetPanel?: QuerySelector | QuerySelector[];

	/** Name of the property to display in UI. Please localize! */
	name: string;

	/** Type of UI for the customizer to generate to modify this style. */
	type: PropertyType;

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
}

interface DynamicStyleWithProperty<PropertyType extends CustomizerPropertyType, StyleProperty extends keyof Style>
	extends DynamicStyleBase<PropertyType> {
	/** Style property to modify. */
	styleProperty: StyleProperty;

	/**
	 * Function to convert stored/configured value to style string.
	 * IMPORTANT: This defaults to the identity function. If you're mapping a number, you need to do
	 * appropriate conversion to string with units here! E.g. (value) => `${value}px`.
	 * @default identity function
	 */
	valueFn?: (value: PropertyTypeToValueTypeMap[PropertyType]) => Style[StyleProperty];
}

interface DynamicStyleWithFunction<PropertyType extends CustomizerPropertyType> extends DynamicStyleBase<PropertyType> {
	func: (panel: GenericPanel, value: PropertyTypeToValueTypeMap[PropertyType]) => void;
}

export type DynamicStyle<
	PropertyType extends CustomizerPropertyType = CustomizerPropertyType,
	StyleProperty extends keyof Style = keyof Style
> = DynamicStyleWithProperty<PropertyType, StyleProperty> | DynamicStyleWithFunction<PropertyType>;

export interface CustomizerComponentProperties {
	/** Allow resizing in the X direction. */
	resizeX: boolean;

	/** Allow resizing in the Y direction. */
	resizeY: boolean;

	/** Styling properties of provided panel or children, for which we generate UI and store values for. */
	dynamicStyles?: Array<
		{
			[K in CustomizerPropertyType]: {
				[P in keyof Style]: DynamicStyle<K, P>;
			}[keyof Style];
		}[CustomizerPropertyType]
	>;
}

export interface IHudCustomizerHandler {
	/** Enable or disable the HUD customizer UI. */
	toggle(enable: boolean): void;

	/**
	 * Load a customizable HUD component.
	 * Must be after HudCustomizer_Ready has fired!
	 */
	loadComponent(panel: GenericPanel, properties: CustomizerComponentProperties): void;
}

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
