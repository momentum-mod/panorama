'use strict';

const UnitsType = {
	None: 0,
	UPS: 1,
	Percent: 2
};

class StickyCharge {
	static OnChargeUpdate( speed, percentage ) {
		let chargeUnitType = $.GetContextPanel().stickyChargeUnitType;

		let speedText;
		switch( chargeUnitType ) {
			case UnitsType.UPS:
				speedText = `${ Math.floor( speed ) }u/s`;
				break;
			case UnitsType.Percent:
				speedText = `${ Math.floor( percentage * 100 ) }%`;
				break;
			default:
				speedText = '';
		}
		$( '#StickyChargeSpeed' ).text = speedText;
		$( '#StickyChargeMeter' ).value = percentage;
	}

	static OnChargeToggled( enabled ) {
		let chargeMeter = $( '#StickyChargeMeter' );
		if ( chargeMeter.enabled !== enabled )
			chargeMeter.enabled = enabled;
	}
}

( function() {
	$.RegisterEventHandler( 'OnChargeUpdate', $( '#StickyChargeContainer' ), StickyCharge.OnChargeUpdate );
	$.RegisterEventHandler( 'OnChargeToggled', $( '#StickyChargeContainer' ), StickyCharge.OnChargeToggled );
})();
