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
		$.RegisterEventHandler('OnChargeUpdate', this.panels.container, (enabled, speed, percentage) =>
			this.onChargeUpdate(enabled, speed, percentage)
		);
	}

	onChargeUpdate(enabled: boolean, speed: float, percentage: float) {
		this.panels.chargeMeter.enabled = enabled;

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
}
