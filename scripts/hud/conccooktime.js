'use strict';

class ConcCook {
	static cookMeter = $( '#ConcCookMeter' );
	static cookLabel = $( '#ConcCookTime' );

	static onCookUpdate( time, percentage ) {
		ConcCook.cookMeter.value = percentage;

		let labelEnabled = $.GetContextPanel().concTimerLabelEnabled
		ConcCook.cookLabel.visible = labelEnabled;
		if ( labelEnabled )
			ConcCook.cookLabel.text = `${ time.toFixed( 2 ) }s`;
	}
}

( function() {
	$.RegisterEventHandler( 'OnCookUpdate', $( '#ConcCooktimeContainer' ), ConcCook.onCookUpdate );
})();
