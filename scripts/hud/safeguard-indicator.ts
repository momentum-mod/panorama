import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class SafeguardHandler {
	readonly panels = {
		container: $<Panel>('#SafeguardContainer')
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
