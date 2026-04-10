import { PanelHandler } from 'util/module-helpers';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';

@PanelHandler()
class SafeguardHandler {
	readonly panels = {
		container: $<Panel>('#SafeguardContainer'),
		meter: $<Image>('#SafeguardMeter')
	};

	holdTime: number;

	constructor() {
		$.RegisterForUnhandledEvent('LevelInitPostEntity', () => this.onMapInit());
		$.RegisterForUnhandledEvent('OnSafeguardSettingChanged', () => {
			this.updateSettings();
		});
		$.RegisterForUnhandledEvent('OnSafeguardCommandHold', () => {
			this.updateVisibility(true);
		});
		$.RegisterForUnhandledEvent('OnSafeguardCommandRelease', () => {
			this.updateVisibility(false);
		});
		$.RegisterForUnhandledEvent('OnSafeguardCommandComplete', () => {
			this.updateVisibility(false);
		});

		registerHUDCustomizerComponent($.GetContextPanel(), {
			resizeX: false,
			resizeY: false,
			//TODO: Add safeguard cvars?
			dynamicStyles: {
				color: {
					name: 'Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.safeguard__meter',
					styleProperty: 'washColor'
				},
				opacity: {
					name: 'Opacity',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.safeguard__meter',
					styleProperty: 'opacity',
					valueFn: (value) => value / 100,
					settingProps: { min: 0, max: 100 }
				}
			}
		});
	}

	onMapInit() {
		this.updateSettings();

		this.panels.container.AddClass('safeguard__container--hide');
	}

	updateSettings() {
		this.holdTime = GameInterfaceAPI.GetSettingFloat('mom_safeguard_holdtime');
		this.panels.container.style.transitionDuration = `${this.holdTime}s`;
	}

	updateVisibility(visible: boolean) {
		if (visible) {
			this.panels.container.RemoveClass('safeguard__container--hide');
			this.panels.container.style.transitionDuration = '0.0s';
		} else {
			this.panels.container.AddClass('safeguard__container--hide');
			this.panels.container.style.transitionDuration = `${this.holdTime}s`;
		}
	}
}
