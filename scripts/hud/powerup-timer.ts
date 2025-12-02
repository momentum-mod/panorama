import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';

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
		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.DEFRAG),
			handledEvents: [{ event: 'HudProcessInput', panel: $.GetContextPanel(), callback: () => this.onUpdate() }]
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
