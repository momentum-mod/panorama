import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from '../util/register-for-gamemodes';
import { Gamemode } from 'common/web/enums/gamemode.enum';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

export enum StickyState {
	NOSTICKY = 0,
	ARMING = 1,
	ARMED = 2,
	BLOCKED = 3
}

//Values get overridden on load, assign defaults in /cfg/hud_default.kv3
const StateColors: Record<StickyState, string> = {
	[StickyState.NOSTICKY]: 'rgba(35, 50, 57, 1)',
	[StickyState.ARMING]: 'rgba(35, 50, 57, 1)',
	[StickyState.ARMED]: 'gradient(linear, 0% 0%, 100% 0%, from (rgba(24, 150, 211, 1), to(rgba(113, 240, 255, 1)))',
	[StickyState.BLOCKED]: 'gradient(linear, 0% 0%, 100% 0%, from (rgba(134, 65, 65, 1), to(rgba(170, 65, 65, 1)))'
};

@PanelHandler()
class StickyCountHandler {
	readonly panels = {
		countContainer: $('#StickyCountContainer')
	};

	private panelStates: Map<GenericPanel, StickyState> = new Map();

	initHandler: number;

	width: number;
	height: number;
	borderRadius: number;
	gap: number;

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: [Gamemode.SJ],
			events: [
				{
					event: 'OnStickyPanelStateChanged',
					callback: (stickyPanel, state, prevstate) =>
						this.onStickyPanelStateChanged(stickyPanel, state, prevstate)
				}
			]
		});

		//THIS IS A HACK FOR INITIALIZING SETTINGS
		//#StickyCountContainer get populated by C++ with individual .sticky-panel
		//This happens after load so the panels cannot be targetted by registerHUDCustomizerComponent
		//initPanels is waiting for the #StickyCountContainer to have 8 children, assigns default values to them and then unregisters itself
		//In order for default values to initialize registerHUDCustomizerComponent cannot target any panels, it won't call a callback if they don't exist
		//this.updateStickyPanels() handles updating all settings, ugly but works for now
		this.initHandler = $.RegisterEventHandler('HudThink', $.GetContextPanel(), () => this.initPanels());

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			gamemode: Gamemode.SJ,
			//TODO: Add box shadow setting
			dynamicStyles: {
				//TODO: Make first 3 options sliders?
				width: {
					name: 'Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.width = value;
						this.updateStickyPanels();
					},
					settingProps: { min: 1, max: 50 }
				},
				height: {
					name: 'Height',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.height = value;
						this.updateStickyPanels();
					},
					settingProps: { min: 1, max: 50 }
				},
				borderRadius: {
					name: 'Border Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.borderRadius = value;
						this.updateStickyPanels();
					},
					settingProps: { min: 0, max: 50 }
				},
				gap: {
					name: 'Gap',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.gap = value;
						this.updateStickyPanels();
					}
				},
				//TODO: Consider allowing for a gradient
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.NOSTICKY] = value;
						this.updateStickyPanels();
					}
				},
				armingGradient: {
					name: 'Arming Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.ARMING] =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
						this.updateStickyPanels();
					}
				},
				armedGradient: {
					name: 'Armed Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.ARMED] =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
						this.updateStickyPanels();
					}
				},
				blockedGradient: {
					name: 'Blocked Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.BLOCKED] =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
						this.updateStickyPanels();
					}
				}
			}
		});
	}

	initPanels() {
		const stickyPanels = this.panels.countContainer.Children();
		if (stickyPanels.length === 8) {
			stickyPanels.forEach((panel) => {
				panel.style.width = `${this.width}px`;
				panel.style.height = `${this.height}px`;
				panel.style.borderRadius = `${this.borderRadius}px`;
				panel.style.margin = `0px ${this.gap}px 0px ${this.gap}px`;
				panel.style.backgroundColor = StateColors[StickyState.NOSTICKY] as color;
				this.panelStates.set(panel, StickyState.NOSTICKY);
			});
			$.UnregisterEventHandler('HudThink', $.GetContextPanel(), this.initHandler);
		}
	}

	updateStickyPanels() {
		this.panelStates.forEach((state, panel) => {
			panel.style.width = `${this.width}px`;
			panel.style.height = `${this.height}px`;
			panel.style.borderRadius = `${this.borderRadius}px`;
			panel.style.margin = `0px ${this.gap}px 0px ${this.gap}px`;
			panel.style.backgroundColor = StateColors[state] as color;
		});
	}

	onStickyPanelStateChanged(stickyPanel: Panel, state: StickyState, prevstate: StickyState) {
		this.panelStates.set(stickyPanel, state);
		stickyPanel.style.backgroundColor = StateColors[state] as color;
	}
}
