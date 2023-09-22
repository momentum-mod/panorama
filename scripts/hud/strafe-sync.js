const COLOR_CLASS_FG = {
	DEFAULT_COLOR: 'strafesync__default-color--fg',
	INCREASE_COLOR: 'strafesync__increase-color--fg',
	DECREASE_COLOR: 'strafesync__decrease-color--fg'
};

const COLOR_CLASS_BG = {
	DEFAULT_COLOR: 'strafesync__default-color--bg',
	INCREASE_COLOR: 'strafesync__increase-color--bg',
	DECREASE_COLOR: 'strafesync__decrease-color--bg'
};

class StrafeSync {
	static lastValue = 0;
	static label = null;
	static bar = null;

	static onUpdate() {
		const type = $.GetContextPanel().strafesyncType;
		const value = MomentumPlayerAPI.GetStrafeSync(type);
		$.GetContextPanel().SetDialogVariable('sync_value', value.toFixed(2));
		this.bar.value = value;

		let colorIndex;
		switch ($.GetContextPanel().strafesyncColorize) {
			case 1:
				if (this.lastValue === 0) colorIndex = 'DEFAULT_COLOR';
				else {
					const diff = value - this.lastValue;
					if (diff > 0) colorIndex = 'INCREASE_COLOR';
					else if (diff < 0) colorIndex = 'DECREASE_COLOR';
					else colorIndex = 'DEFAULT_COLOR';
				}
				break;
			case 2:
				if (value === 0) colorIndex = 'DEFAULT_COLOR';
				else if (value > 90) colorIndex = 'INCREASE_COLOR';
				else if (value < 75) colorIndex = 'DECREASE_COLOR';
				else colorIndex = 'DEFAULT_COLOR';
				break;
			case 0:
			default:
				colorIndex = 'DEFAULT_COLOR';
				break;
		}

		this.lastValue = value;

		for (const colorclassfgKey in COLOR_CLASS_FG) {
			this.label.RemoveClass(COLOR_CLASS_FG[colorclassfgKey]);
		}
		this.label.AddClass(COLOR_CLASS_FG[colorIndex]);

		for (const colorclassbgKey in COLOR_CLASS_BG) {
			this.bar.RemoveClass(COLOR_CLASS_BG[colorclassbgKey]);
		}
		this.bar.AddClass(COLOR_CLASS_BG[colorIndex]);

		return true;
	}

	static {
		$.RegisterEventHandler('ChaosHudProcessInput', $.GetContextPanel(), this.onUpdate.bind(this));

		/** @type {ProgressBar} @static */
		this.bar = $('#SyncProgressBar');
		/** @type {Label} @static */
		this.label = $('#SyncLabel');
	}
}
