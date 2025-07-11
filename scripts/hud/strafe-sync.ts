import { PanelHandler } from 'util/module-helpers';
import * as Enum from 'util/enum';

enum ColorClassFG {
	DEFAULT_COLOR = 'strafesync__default-color--fg',
	INCREASE_COLOR = 'strafesync__increase-color--fg',
	DECREASE_COLOR = 'strafesync__decrease-color--fg'
}

enum ColorClassBG {
	DEFAULT_COLOR = 'strafesync__default-color--bg',
	INCREASE_COLOR = 'strafesync__increase-color--bg',
	DECREASE_COLOR = 'strafesync__decrease-color--bg'
}

@PanelHandler()
class StrafeSync {
	readonly panels = {
		cp: $.GetContextPanel<MomHudStrafeSync>(),
		bar: $<ProgressBar>('#SyncProgressBar'),
		label: $<Label>('#SyncLabel')
	};

	lastValue = 0;

	constructor() {
		$.RegisterEventHandler('HudProcessInput', $.GetContextPanel(), () => this.onUpdate());
	}

	onUpdate() {
		const type = this.panels.cp.strafesyncType;
		const value = MomentumPlayerAPI.GetStrafeSync(type);
		$.GetContextPanel().SetDialogVariable('sync_value', value.toFixed(2));
		this.panels.bar.value = value;

		let colorIndex: ColorClassFG | ColorClassBG;
		switch (this.panels.cp.strafesyncColorize) {
			case 1:
				if (this.lastValue === 0) colorIndex = ColorClassFG.DEFAULT_COLOR;
				else {
					const diff = value - this.lastValue;
					if (diff > 0) colorIndex = ColorClassFG.INCREASE_COLOR;
					else if (diff < 0) colorIndex = ColorClassFG.DECREASE_COLOR;
					else colorIndex = ColorClassFG.DEFAULT_COLOR;
				}
				break;
			case 2:
				if (value === 0) colorIndex = ColorClassFG.DEFAULT_COLOR;
				else if (value > 90) colorIndex = ColorClassFG.INCREASE_COLOR;
				else if (value < 75) colorIndex = ColorClassFG.DECREASE_COLOR;
				else colorIndex = ColorClassFG.DEFAULT_COLOR;
				break;
			case 0:
			default:
				colorIndex = ColorClassFG.DEFAULT_COLOR;
				break;
		}

		this.lastValue = value;

		for (const colorClassFG in Enum.fastKeysString(ColorClassFG)) {
			this.panels.label.RemoveClass(colorClassFG);
		}
		this.panels.label.AddClass(colorIndex);

		for (const colorClassBG in Enum.fastKeysString(ColorClassBG)) {
			this.panels.bar.RemoveClass(colorClassBG);
		}
		this.panels.bar.AddClass(colorIndex);
	}
}
