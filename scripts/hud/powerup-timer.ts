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
		},
		airJump: {
			panel: $('#AirJumpIndicator')!,
			icon: $<Image>('#AirJumpIcon')!
		}
	};

	constructor() {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Powerup_Timer_Name'),
			resizeX: false,
			resizeY: false,
			gamemode: GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			events: { event: 'HudProcessInput', panel: $.GetContextPanel(), callbackFn: () => this.onUpdate() },
			dynamicStyles: {
				font: {
					name: $.Localize('#Customizer_Font'),
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.powerup-timer__label',
					styleProperty: 'fontFamily',
					valueFn: (value) => `"${value}"`
				},
				fontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.powerup-timer__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				fontColor: {
					name: $.Localize('#Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.powerup-timer__label',
					styleProperty: 'color',
					callbackFunc: (panel, value) =>
						(panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9))
				}
			}
		});
	}

	onUpdate() {
		const { damageBoostTime, hasteTime, slickTime, flightTime, airJumpEnabled, canAirJump } =
			MomentumMovementAPI.GetMoveHudData();

		this.updatePanel(this.panels.damageBoost, damageBoostTime);
		this.updatePanel(this.panels.haste, hasteTime);
		this.updatePanel(this.panels.slick, slickTime);
		this.updatePanel(this.panels.flight, flightTime);
		this.updateAirJump(airJumpEnabled, canAirJump);
	}

	updatePanel({ panel, label }: { panel: GenericPanel; label: Label }, time: number) {
		if (!time) {
			panel.visible = false;
		} else {
			panel.visible = true;
			label.text = time < 0 ? '∞' : Math.ceil(time / 1000).toString();
		}
	}

	updateAirJump(enabled: boolean, canAirJump: boolean) {
		const { panel, icon } = this.panels.airJump;

		// Only show the indicator while the player has the air jump powerup
		panel.visible = enabled;
		if (!enabled) return;

		// Grey the icon out when the air jump has already been used
		icon.SetHasClass('powerup-timer__icon--disabled', !canAirJump);
	}
}
