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
			//TODO: Figure out how to add a dummy indicator without breaking clips
			dynamicStyles: {
				//As of writing this there is no way to re-rasterize an svg as the textureheight needs to be set on panel creation
				//There should be some way to rerasterize an image added to panorama, perhaps it should even happen automatically when textureheight is changed
				size: {
					name: 'Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.panels.container.RemoveAndDeleteChildren();

						this.panels.meter = $.CreatePanel('Image', this.panels.container, 'SafeguardMeter', {
							textureheight: value,
							class: 'safeguard__meter'
						});

						this.panels.meter.SetImage('file://{images}/hud/safeguard-indicator.svg');

						this.panels.container.style.width = `${value}px`;
						this.panels.container.style.height = `${value}px`;
					}
				},
				color: {
					name: 'Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.safeguard__meter',
					callbackFunc: (panel, value) => {
						const splitRGBA = this.splitRgbFromAlpha(value);

						panel.style.washColor = splitRGBA[0];
						panel.style.opacity = splitRGBA[1];
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

	splitRgbFromAlpha(rgbaString: string) {
		const values = rgbaString.match(/[\d.]+%?/g);
		return [`rgba(${values[0]}, ${values[1]}, ${values[2]}, 1)`, values[3]];
	}
}
