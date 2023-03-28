'use strict';

class BonkDetector {
	/** @type {Panel} @static */
	static container = $('#BonkContainer');

	static onLoad() {
		//this.initializeSettings();
	}

	static onBonk(speed) {
		//
	}

	static {
		$.RegisterForUnhandledEvent('ChaosLevelInitPostEntity', this.onLoad.bind(this));
		$.RegisterForUnhandledEvent('OnBonkSpeedUpdate', this.onBonk.bind(this));
	}
}
