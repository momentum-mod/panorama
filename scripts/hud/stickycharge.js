'use strict';

const UnitsType = {
	None: 0,
	UPS: 1,
	Percent: 2
};

class StickyCharge {
	static chargeUnitsType = UnitsType.None;

	static OnChargeUpdate( speed, percentage ) {
		let speedText;
		switch( StickyCharge.chargeUnitsType ) {
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
	$.RegisterForUnhandledEvent( 'OnChargeSpeedUnitsChanged', ( unitType ) => { StickyCharge.chargeUnitsType = unitType; } );
})();
