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
	[CustomizerPropertyType.COLOR_PICKER]: ColorPicker;
}

export type QuerySelector = `#${string}` | `.${string}`;

interface DynamicStyleBase<PropertyType extends CustomizerPropertyType> {
	/**
	 * Selector or array of selectors.
	 * Prefix # for ID, . for class, same as JSDollarSign. Will throw without prefix.
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
		// Psycho type mappings to ensure limit allowed properties to those
		// on the panel type corresponding to PropertyType
		[K in keyof PropertyTypeMap[PropertyType]]?: K extends keyof GenericPanel
			? never
			: PropertyTypeMap[PropertyType][K] extends (...args: any) => any
				? never
				: PropertyTypeMap[PropertyType][K];
	};
}

interface DynamicStyleWithProperty {
	/** Style property to modify. */
	styleProperty: keyof Style;
	valueFn?: (value: unknown) => Style[keyof Style];
}

interface DynamicStyleWithFunction {
	func: (panel: GenericPanel, value: unknown) => void;
}

export type DynamicStyle<PropertyType extends CustomizerPropertyType = CustomizerPropertyType> =
	DynamicStyleBase<PropertyType> &
		(
			| (DynamicStyleWithProperty & { [K in keyof DynamicStyleWithFunction]?: never }) // Mutually exclusive types
			| (DynamicStyleWithFunction & { [K in keyof DynamicStyleWithProperty]?: never })
		);

export interface CustomizerComponentProperties {
	/** Allow resizing in the X direction. */
	resizeX: boolean;

	/** Allow resizing in the Y direction. */
	resizeY: boolean;

	/** Styling properties of provided panel or children, for which we generate UI and store values for. */
	dynamicStyles?: Array<{ [K in CustomizerPropertyType]: DynamicStyle<K> }[CustomizerPropertyType]>;
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
