'use strict';

const COLOR_CLASS = {
	AIR: 'dfjump__press--air',
	GROUND: 'dfjump__press--ground'
};

const DEFAULT_DELAY = 360;

class DFJump {
	/** @type {Panel} @static */
	static container = $('#DFJumpContainer');
	/** @type {ProgressBar} @static */
	static releaseBar = $('#JumpReleaseBar');
	/** @type {ProgressBar} @static */
	static pressBar = $('#JumpPressBar');
	/** @type {Label} @static */
	static releaseLabel = $('#JumpReleaseLabel');
	/** @type {Label} @static */
	static pressLabel = $('#JumpPressLabel');
	/** @type {Label} @static */
	static totalLabel = $('#JumpTotalLabel');

	static onLoad() {
		this.initializeSettings();
		this.colorClass = COLOR_CLASS.GROUND;
	}

	static onDFJumpUpdate(releaseDelay, pressDelay, totalDelay) {
		const releaseRatio = releaseDelay * this.inverseMaxDelay;
		const pressRatio = Math.abs(pressDelay) * this.inverseMaxDelay;
		const newPressColorClass = pressDelay < 0 ? COLOR_CLASS.GROUND : COLOR_CLASS.AIR;

		this.releaseBar.value = releaseRatio;
		this.pressBar.value = pressRatio;
		this.pressBar.RemoveClass(this.colorClass);
		this.pressBar.AddClass(newPressColorClass);
		this.colorClass = newPressColorClass;

		this.releaseLabel.text = releaseDelay.toFixed();
		this.pressLabel.text = pressDelay.toFixed();
		this.totalLabel.text = totalDelay.toFixed();
	}

	static setMaxDelay(newDelay) {
		this.inverseMaxDelay = 1.0 / (newDelay ?? DEFAULT_DELAY);
	}

	static initializeSettings() {
		this.setMaxDelay(GameInterfaceAPI.GetSettingInt('mom_df_hud_jump_max_delay'));
	}

	static {
		$.RegisterEventHandler('DFJumpDataUpdate', this.container, this.onDFJumpUpdate.bind(this));

		$.RegisterForUnhandledEvent('ChaosLevelInitPostEntity', this.onLoad.bind(this));
		$.RegisterForUnhandledEvent('DFJumpMaxDelayChanged', this.setMaxDelay.bind(this));
	}
}
