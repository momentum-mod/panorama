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

//These values don't matter, defaults should be set through momentum/cfg/hud_default.kv3
const Colors = {
	BACKGROUND: 'rgba(35, 50, 57, 1)',
	ARMING: 'rgba(35, 50, 57, 1)',
	ARMED: 'gradient(linear, 0% 0%, 100% 0%, from (rgba(24, 150, 211, 1), to(rgba(113, 240, 255, 1)))',
	BLOCKED: 'gradient(linear, 0% 0%, 100% 0%, from (rgba(134, 65, 65, 1), to(rgba(170, 65, 65, 1)))'
};

@PanelHandler()
class StickyCountHandler {
	readonly panels = {
		countContainer: $('#StickyCountContainer')
	};

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
						Colors.BACKGROUND = value;
						this.stupidInitializeHack();
					}
				},
				armingGradient: {
					name: 'Arming Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						Colors.ARMING = `gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
					}
				},
				armedGradient: {
					name: 'Armed Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						Colors.ARMED = `gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
					}
				},
				blockedGradient: {
					name: 'Blocked Gradient',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						Colors.BLOCKED = `gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))`;
					}
				}
			}
		});
	}

	stupidInitializeHack() {
		const stickyPanels = this.panels.countContainer.Children();
		stickyPanels.forEach((panel) => {
			panel.style.backgroundColor = Colors.BACKGROUND as color;
		});
	}

	onStickyPanelStateChanged(stickyPanel: Panel, state: StickyState, prevstate: StickyState) {
		switch (state) {
			case StickyState.ARMED:
				stickyPanel.style.backgroundColor = Colors.ARMED as color;
				break;
			case StickyState.ARMING:
				stickyPanel.style.backgroundColor = Colors.ARMING as color;
				break;
			case StickyState.BLOCKED:
				stickyPanel.style.backgroundColor = Colors.BLOCKED as color;
				break;
			case StickyState.NOSTICKY:
				stickyPanel.style.backgroundColor = Colors.BACKGROUND as color;
				break;
		}
	}
}
