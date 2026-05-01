import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { splitRgbFromAlpha } from 'util/colors';

export enum StickyState {
	NOSTICKY = 0,
	ARMING = 1,
	ARMED = 2,
	BLOCKED = 3
}

// Values get overridden on load, assign defaults in /cfg/hud_default.kv3
const StateColors: Record<StickyState, string> = {
	[StickyState.NOSTICKY]: 'rgba(35, 50, 57, 1)',
	[StickyState.ARMING]: 'rgba(35, 50, 57, 1)',
	[StickyState.ARMED]: 'gradient(linear, 0% 0%, 100% 0%, from (rgba(24, 150, 211, 1), to(rgba(113, 240, 255, 1)))',
	[StickyState.BLOCKED]: 'gradient(linear, 0% 0%, 100% 0%, from (rgba(134, 65, 65, 1), to(rgba(170, 65, 65, 1)))'
};

type StickyCountConfigType = {
	width: string;
	height: string;
	borderRadius: string;
	borderWidth: string;
	borderColor: rgbaColor;
	margin: string;
};

@PanelHandler()
class StickyCountHandler {
	readonly panels = {
		countContainer: $('#StickyCountContainer')
	};

	private panelStates: Map<GenericPanel, StickyState> = new Map();

	// Needs random values for intialization, set defaults in /config/hud_default.kv3
	config = {
		width: '24px',
		height: '24px',
		borderRadius: '50%',
		borderWidth: '0px',
		borderColor: 'rgba(0, 0, 0, 1)' as rgbaColor
	} as StickyCountConfigType;

	initHandler: number;
	constructor() {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			gamemode: GamemodeCategoryToGamemode.get(GamemodeCategory.SJ),
			unhandledEvents: [
				{
					event: 'OnStickyPanelStateChanged',
					callbackFn: (stickyPanel, state) => this.onStickyPanelStateChanged(stickyPanel, state)
				},
				// THIS IS A HACK FOR INITIALIZING SETTINGS
				// #StickyCountContainer get populated by C++ with individual .sticky-panel
				// This happens after load so the panels cannot be targetted by registerHUDCustomizerComponent
				// initPanels is waiting for the #StickyCountContainer to have 8 children, assigns default values to them and then unregisters itself
				// In order for default values to initialize registerHUDCustomizerComponent cannot target any panels, it won't call a callback if they don't exist
				// this.updateStickyPanels() handles updating all settings, ugly but works for now
				{ event: 'LevelInitPostEntity', callbackFn: () => this.initPanels() }
			],
			dynamicStyles: {
				colors: {
					name: 'Colors',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'backgroundGradient' },
						{ styleID: 'armingGradient' },
						{ styleID: 'armedGradient' },
						{ styleID: 'blockedGradient' }
					]
				},
				backgroundGradient: {
					name: 'Background',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.NOSTICKY] =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
						this.updateStickyPanels();
					}
				},
				armingGradient: {
					name: 'Arming',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.ARMING] =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
						this.updateStickyPanels();
					}
				},
				armedGradient: {
					name: 'Armed',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.ARMED] =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
						this.updateStickyPanels();
					}
				},
				blockedGradient: {
					name: 'Blocked',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.BLOCKED] =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
						this.updateStickyPanels();
					}
				},
				borderStyling: {
					name: 'Border Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'borderWidth' }, { styleID: 'borderColor' }, { styleID: 'borderRadius' }]
				},
				borderWidth: {
					name: 'Border Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.config.borderWidth = `${value}px`;
						this.updateStickyPanels();
					}
				},
				borderColor: {
					name: 'Border Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						this.config.borderColor = value as rgbaColor;
						this.updateStickyPanels();
					}
				},
				borderRadius: {
					name: 'Border Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.config.borderRadius = `${value}%`;
						this.updateStickyPanels();
					},
					settingProps: { min: 0, max: 50 }
				},
				width: {
					name: 'Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.config.width = `${value}px`;
						this.updateStickyPanels();
					}
				},
				height: {
					name: 'Height',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.config.height = `${value}px`;
						this.updateStickyPanels();
					}
				},

				gap: {
					name: 'Gap',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.config.margin = `0 ${value}px`;
						this.updateStickyPanels();
					}
				}
			}
		});
	}
	initPanels() {
		this.initHandler = $.RegisterEventHandler('HudThink', $.GetContextPanel(), () => this.checkForChildren());
	}

	checkForChildren() {
		const stickyPanels = this.panels.countContainer.Children();
		if (stickyPanels.length === 8) {
			const splitRGBA = splitRgbFromAlpha(StateColors[StickyState.NOSTICKY] as rgbaColor);

			stickyPanels.forEach((panel) => {
				for (const [key, value] of Object.entries(this.config)) {
					panel.style[key] = value;
				}
				panel.style.backgroundColor = StateColors[StickyState.NOSTICKY] as color;
				panel.style.boxShadow = `rgba(0, 0, 0, ${splitRGBA.alpha * 0.5}) 0px 0px 3px 0px`;
				this.panelStates.set(panel, StickyState.NOSTICKY);
			});
			$.UnregisterEventHandler('HudThink', $.GetContextPanel(), this.initHandler);
		}
	}

	updateStickyPanels() {
		this.panelStates.forEach((state, panel) => {
			const splitRGBA = splitRgbFromAlpha(StateColors[state] as rgbaColor);
			for (const [key, value] of Object.entries(this.config)) {
				panel.style[key] = value;
			}

			panel.style.backgroundColor = StateColors[state] as color;
			panel.style.boxShadow = `rgba(0, 0, 0, ${splitRGBA.alpha * 0.5}) 0px 0px 3px 0px`;
		});
	}

	onStickyPanelStateChanged(stickyPanel: Panel, state: StickyState) {
		this.panelStates.set(stickyPanel, state);
		stickyPanel.style.backgroundColor = StateColors[state] as color;
	}
}
