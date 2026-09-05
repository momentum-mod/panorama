import { PanelHandler } from 'util/module-helpers';
import { Style, styleEnglishName } from 'common/web/enums/style.enum';
import { GamemodeStyles } from 'common/web/maps/gamemode-styles.map';

/**
 * Dropdown of the gamemode's run styles, shown in the top-right of the map selector and tab menu.
 * Exactly one style is selected at a time; picking a different one fires the registered callback so
 * the owner can reload its leaderboard/completions for that style.
 */
@PanelHandler({ exposeToPanel: true })
export class StyleSelectorHandler {
	readonly panels = {
		cp: $.GetContextPanel<StyleSelector>(),
		dropdown: $<DropDown>('#StyleDropdown')
	};

	// Dropdown option ids are panel ids, so they can't be bare numbers. Prefix the style value.
	private static readonly OPTION_ID_PREFIX = 'Style_';

	private gamemode: Gamemode | null = null;
	private styles: Style[] = [];
	private selectedStyle: Style = Style.NORMAL;
	private onStyleChanged: ((style: Style) => void) | null = null;
	private trackSelector: TrackSelector | null = null;

	constructor() {
		this.panels.dropdown.SetPanelEvent('oninputsubmit', () => this.onDropdownChanged());
	}

	/** The style currently selected. */
	get style(): Style {
		return this.selectedStyle;
	}

	connectTrackSelector(trackSelector: TrackSelector) {
		this.trackSelector = trackSelector;
	}

	/** Register the callback fired whenever the user picks a different style. */
	setStyleChangedCallback(callback: (style: Style) => void) {
		this.onStyleChanged = callback;
	}

	/**
	 * Rebuild the list for a gamemode, resetting to that mode's default leaderboard style. Styles are
	 * per-gamemode, so this must be called whenever the mode being viewed changes. Doesn't fire the
	 * style changed callback - callers changing gamemode are reloading their data anyway, and should
	 * read {@link style} for the style to load.
	 */
	setGamemode(gamemode: Gamemode) {
		if (this.gamemode === gamemode) return;
		this.gamemode = gamemode;

		this.styles = [...(GamemodeStyles.get(gamemode) ?? [Style.NORMAL])];

		const defaultStyle = GameModeAPI.GetDefaultLeaderboardRunStyle(gamemode);
		this.selectedStyle = this.styles.includes(defaultStyle) ? defaultStyle : this.styles[0];

		this.render();
	}

	private render() {
		this.panels.dropdown.RemoveAllOptions();

		for (const style of this.styles) {
			const option = $.CreatePanel('Label', this.panels.dropdown, StyleSelectorHandler.optionId(style));
			option.text = styleEnglishName(style);
			this.panels.dropdown.AddOption(option);
		}

		// Programmatic; doesn't fire oninputsubmit, so it won't re-trigger the change callback.
		this.panels.dropdown.SetSelected(StyleSelectorHandler.optionId(this.selectedStyle));

		// Nothing to pick between for a single-style mode.
		this.panels.dropdown.enabled = this.styles.length > 1;
	}

	private onDropdownChanged() {
		const selected = StyleSelectorHandler.styleFromOptionId(this.panels.dropdown.GetSelected()?.id);
		if (selected == null || selected === this.selectedStyle) return;

		this.selectedStyle = selected;
		this.onStyleChanged?.(selected);
		this.trackSelector?.handler.updateEorButtonVisibility();
	}

	private static optionId(style: Style): string {
		return `${StyleSelectorHandler.OPTION_ID_PREFIX}${style}`;
	}

	private static styleFromOptionId(id: string | undefined): Style | null {
		if (!id?.startsWith(StyleSelectorHandler.OPTION_ID_PREFIX)) return null;
		return Number(id.slice(StyleSelectorHandler.OPTION_ID_PREFIX.length)) as Style;
	}
}
