import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from 'util/register-for-gamemodes';
import { GamemodeCategories, GamemodeCategory } from 'common/web';

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
		}
	};

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.DEFRAG),
			events: [{ event: 'HudProcessInput', callback: () => this.onUpdate() }]
		});
	}

	onUpdate() {
		const { damageBoostTime, hasteTime, slickTime } = MomentumMovementAPI.GetLastMoveData();

		this.updatePanel(this.panels.damageBoost, damageBoostTime);
		this.updatePanel(this.panels.haste, hasteTime);
		this.updatePanel(this.panels.slick, slickTime);
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
