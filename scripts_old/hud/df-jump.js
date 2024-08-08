"use strict";
var DFJump;
(function (DFJump) {
    let ColorClass;
    (function (ColorClass) {
        ColorClass["AIR"] = "dfjump__press--air";
        ColorClass["GROUND"] = "dfjump__press--ground";
    })(ColorClass || (ColorClass = {}));
    class Component {
        static panels = {
            container: $('#DFJumpContainer'),
            releaseBar: $('#JumpReleaseBar'),
            pressBar: $('#JumpPressBar'),
            releaseLabel: $('#JumpReleaseLabel'),
            pressLabel: $('#JumpPressLabel'),
            totalLabel: $('#JumpTotalLabel')
        };
        static colorClass;
        static inverseMaxDelay;
        static defaultDelay = 360;
        static onLoad() {
            this.initializeSettings();
            this.colorClass = ColorClass.GROUND;
        }
        static onDFJumpUpdate(releaseDelay, pressDelay, totalDelay) {
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
        static setMaxDelay(newDelay) {
            this.inverseMaxDelay = 1 / (newDelay ?? this.defaultDelay);
        }
        static initializeSettings() {
            this.setMaxDelay(GameInterfaceAPI.GetSettingInt('mom_df_hud_jump_max_delay'));
        }
        static {
            $.RegisterEventHandler('DFJumpDataUpdate', this.panels.container, this.onDFJumpUpdate.bind(this));
            $.RegisterForUnhandledEvent('LevelInitPostEntity', () => this.onLoad());
            $.RegisterForUnhandledEvent('DFJumpMaxDelayChanged', (newDelay) => this.setMaxDelay(newDelay));
        }
    }
})(DFJump || (DFJump = {}));
