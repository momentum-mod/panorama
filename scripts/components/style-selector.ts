import { PanelHandler } from 'util/module-helpers';
import { Style, styleShortName } from 'common/web/enums/style.enum';
import { GamemodeStyles } from 'common/web/maps/gamemode-styles.map';

/**
 * Horizontal radio list of the gamemode's run styles, sitting above the track selector.
 */
@PanelHandler({ exposeToPanel: true })
export class StyleSelectorHandler {
	readonly panels = {
		cp: $.GetContextPanel<StyleSelector>(),
		items: $<Panel>('#StyleSelectorItems')
	};

	private readonly buttons = new Map<Style, RadioButton>();
	private gamemode: Gamemode | null = null;
	private styles: Style[] = [];
	private selectedStyle: Style = Style.NORMAL;
	private onStyleChanged: ((style: Style) => void) | null = null;

	/** The style currently selected. */
	get style(): Style {
		return this.selectedStyle;
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
		this.panels.items.RemoveAndDeleteChildren();
		this.buttons.clear();

		// A shared group makes the buttons behave as a radio set: selecting one deselects the rest.
		const group = this.panels.cp.id + 'StyleGroup';

		for (const style of this.styles) {
			const button = $.CreatePanel('RadioButton', this.panels.items, '', { class: 'style-selector__item' });
			button.group = group;
			$.CreatePanel('Label', button, '', {
				class: 'style-selector__item-label',
				text: styleShortName(style)
			});

			// Set the default selection before wiring the handler, so it doesn't fire the callback.
			if (style === this.selectedStyle) button.SetSelected(true);
			button.SetPanelEvent('onactivate', () => this.selectStyle(style));

			this.buttons.set(style, button);
		}
	}

	private selectStyle(style: Style) {
		if (style === this.selectedStyle) return;

		this.selectedStyle = style;
		this.buttons.get(style)?.SetSelected(true);
		this.onStyleChanged?.(style);
	}
}
