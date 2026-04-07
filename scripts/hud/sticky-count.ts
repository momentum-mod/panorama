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

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			//TODO: Figure out how to initialize this
			//TODO: Add box shadow setting
			dynamicStyles: {
				//TODO: Make first 3 options sliders?
				width: {
					name: 'Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.sticky-panel',
					styleProperty: 'width',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 1, max: 50 }
				},
				height: {
					name: 'Height',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.sticky-panel',
					styleProperty: 'height',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 1, max: 50 }
				},
				borderRadius: {
					name: 'Border Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.sticky-panel',
					styleProperty: 'borderRadius',
					valueFn: (value) => `${value}%`,
					settingProps: { min: 0, max: 50 }
				},
				gap: {
					name: 'Gap',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.sticky-panel',
					styleProperty: 'margin',
					valueFn: (value) => `0px ${value}px 0px ${value}px`
				},

				//TODO: Consider allowing for a gradient
				//TODO: Remove the stupid initialize hack
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.NOSTICKY] = value;
						this.stupidInitializeHack();
						this.updateColors();
					}
				},
				armingGradient: {
					name: 'Arming Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.ARMING] =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
						this.updateColors();
					}
				},
				armedGradient: {
					name: 'Armed Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.ARMED] =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
						this.updateColors();
					}
				},
				blockedGradient: {
					name: 'Blocked Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[StickyState.BLOCKED] =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
						this.updateColors();
					}
				}
			}
		});
	}

	stupidInitializeHack() {
		const stickyPanels = this.panels.countContainer.Children();
		stickyPanels.forEach((panel) => {
			panel.style.backgroundColor = StateColors[StickyState.NOSTICKY] as color;
			this.panelStates.set(panel, StickyState.NOSTICKY);
		});
	}

	updateColors() {
		this.panelStates.forEach((state, panel) => {
			panel.style.backgroundColor = StateColors[state] as color;
		});
	}

	onStickyPanelStateChanged(stickyPanel: Panel, state: StickyState, prevstate: StickyState) {
		this.panelStates.set(stickyPanel, state);
		stickyPanel.style.backgroundColor = StateColors[state] as color;
	}
}
