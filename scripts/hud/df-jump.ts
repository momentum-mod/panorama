namespace DFJump {
	enum ColorClass {
		AIR = 'dfjump__press--air',
		GROUND = 'dfjump__press--ground'
	}

	class Component {
		static panels = {
			container: $<Panel>('#DFJumpContainer'),
			releaseBar: $<ProgressBar>('#JumpReleaseBar'),
			pressBar: $<ProgressBar>('#JumpPressBar'),
			releaseLabel: $<Label>('#JumpReleaseLabel'),
			pressLabel: $<Label>('#JumpPressLabel'),
			totalLabel: $<Label>('#JumpTotalLabel')
		};

		static colorClass: ColorClass;
		static inverseMaxDelay: float;

		static readonly defaultDelay = 360;

		static onLoad() {
			this.initializeSettings();
			this.colorClass = ColorClass.GROUND;
		}

		static onDFJumpUpdate(releaseDelay: float, pressDelay: float, totalDelay: float) {
			const releaseRatio = releaseDelay * this.inverseMaxDelay;
			const pressRatio = Math.abs(pressDelay) * this.inverseMaxDelay;
			const newPressColorClass = pressDelay < 0 ? ColorClass.GROUND : ColorClass.AIR;

			this.panels.releaseBar.value = releaseRatio;
			this.panels.pressBar.value = pressRatio;
			this.panels.pressBar.RemoveClass(this.colorClass);
			this.panels.pressBar.AddClass(newPressColorClass);
			this.colorClass = newPressColorClass;

			this.panels.releaseLabel.text = releaseDelay.toFixed(0);
			this.panels.pressLabel.text = pressDelay.toFixed(0);
			this.panels.totalLabel.text = totalDelay.toFixed(0);
		}

		static setMaxDelay(newDelay: float) {
			this.inverseMaxDelay = 1 / (newDelay ?? this.defaultDelay);
		}

		static initializeSettings() {
			this.setMaxDelay(GameInterfaceAPI.GetSettingInt('mom_df_hud_jump_max_delay'));
		}

		static {
			$.RegisterEventHandler('DFJumpDataUpdate', this.panels.container, this.onDFJumpUpdate.bind(this));

			$.RegisterForUnhandledEvent('LevelInitPostEntity', () => this.onLoad());
			$.RegisterForUnhandledEvent('DFJumpMaxDelayChanged', (newDelay: float) => this.setMaxDelay(newDelay));
		}
	}
}
