import { PanelHandler } from 'util/module-helpers';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { rgbaStringToTuple } from 'util/colors';

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
			name: 'Safeguard Indicator',
			resizeX: false,
			resizeY: false,
			// TODO: Add safeguard cvars?
			// TODO: Figure out how to add a dummy indicator without breaking clips
			dynamicStyles: {
				size: {
					name: 'Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.panels.meter.SetSvgTextureSize(value, value);

						this.panels.container.style.width = `${value}px`;
						this.panels.container.style.height = `${value}px`;
					}
				},
				color: {
					name: 'Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.safeguard__meter',
					callbackFunc: (panel, value) => {
						const [r, g, b, alpha] = rgbaStringToTuple(value as rgbaColor);

						panel.style.washColor = `rgb(${r}, ${g}, ${b})`;
						panel.style.opacity = alpha / 255;
					}
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
