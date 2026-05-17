import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { getTextShadowFast } from 'common/hud-customizer';

@PanelHandler()
class PowerupTimerHandler {
	readonly panels = {
		damageBoost: {
			panel: $('#DamageBoostTimer')!,
			label: $<Label>('#DamageBoostLabel')!
		},
		haste: {
			panel: $('#HasteTimer')!,
			label: $<Label>('#HasteLabel')!
		},
		slick: {
			panel: $('#SlickTimer')!,
			label: $<Label>('#SlickLabel')!
		},
		flight: {
			panel: $('#FlightTimer')!,
			label: $<Label>('#FlightLabel')!
		}
	};

	constructor() {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: 'Powerup Timer',
			resizeX: false,
			resizeY: false,
			gamemode: GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			events: { event: 'HudProcessInput', panel: $.GetContextPanel(), callbackFn: () => this.onUpdate() },
			dynamicStyles: {
				font: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.powerup-timer__label',
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.powerup-timer__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.powerup-timer__label',
					styleProperty: 'color',
					callbackFunc: (panel, value) => {
						panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9);
					}
				}
			}
		});
	}

	onUpdate() {
		const { damageBoostTime, hasteTime, slickTime, flightTime } = MomentumMovementAPI.GetMoveHudData();

		this.updatePanel(this.panels.damageBoost, damageBoostTime);
		this.updatePanel(this.panels.haste, hasteTime);
		this.updatePanel(this.panels.slick, slickTime);
		this.updatePanel(this.panels.flight, flightTime);
	}

	updatePanel({ panel, label }: { panel: GenericPanel; label: Label }, time: number) {
		if (!time) {
			panel.visible = false;
		} else {
			panel.visible = true;
			label.text = time < 0 ? '∞' : Math.ceil(time / 1000).toString();
		}
	}
}
