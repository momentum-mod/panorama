import { PanelHandler } from 'util/module-helpers';

export enum StickyChargeUnit {
	NONE = 0,
	UPS = 1,
	PERCENT = 2
}

@PanelHandler()
class StickyChargeHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudStickyCharge>(),
		container: $<Panel>('#StickyChargeContainer'),
		chargeMeter: $<ProgressBar>('#StickyChargeMeter'),
		chargeSpeed: $<Label>('#StickyChargeSpeed')
	};

	constructor() {
		$.RegisterEventHandler('OnChargeUpdate', this.panels.container, (speed, percentage) =>
			this.onChargeUpdate(speed, percentage)
		);
		$.RegisterEventHandler('OnChargeToggled', this.panels.container, (enabled) => this.onChargeToggled(enabled));
	}

	onChargeUpdate(speed: float, percentage: float) {
		const chargeUnit = this.panels.cp.stickyChargeUnitType;

		let speedText;
		switch (chargeUnit) {
			case StickyChargeUnit.UPS:
				speedText = `${Math.floor(speed)}u/s`;
				break;
			case StickyChargeUnit.PERCENT:
				speedText = `${Math.floor(percentage * 100)}%`;
				break;
			default:
				speedText = '';
		}

		this.panels.chargeSpeed.text = speedText;
		this.panels.chargeMeter.value = percentage;
	}

	onChargeToggled(enabled: boolean) {
		if (this.panels.chargeMeter.enabled !== enabled) {
			this.panels.chargeMeter.enabled = enabled;
		}
	}
}
