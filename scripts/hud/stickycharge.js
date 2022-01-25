'use strict';

const UnitsType = {
	None: 0,
	UPS: 1,
	Percent: 2
};

class StickyCharge {
	static chargeMeter = $('#StickyChargeMeter');
	static chargeSpeed = $('#StickyChargeSpeed');
	static container = $('#StickyChargeContainer');

	static OnChargeUpdate( speed, percentage ) {
		const chargeUnitType = $.GetContextPanel().stickyChargeUnitType;

		let speedText;
		switch(chargeUnitType) {
			case UnitsType.UPS:
				speedText = `${Math.floor(speed)}u/s`;
				break;
			case UnitsType.Percent:
				speedText = `${Math.floor(percentage * 100)}%`;
				break;
			default:
				speedText = '';
		}
		this.chargeSpeed.text = speedText;
		this.chargeMeter.value = percentage;
	}

	static OnChargeToggled(enabled) {
		if (this.chargeMeter.enabled !== enabled) this.chargeMeter.enabled = enabled;
	}

	static {
		$.RegisterEventHandler('OnChargeUpdate', this.container, this.OnChargeUpdate.bind(this));
		$.RegisterEventHandler('OnChargeToggled', this.container, this.OnChargeToggled.bind(this));
	}
}
