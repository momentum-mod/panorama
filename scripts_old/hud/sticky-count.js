"use strict";
var StickyCount;
(function (StickyCount) {
    let StickyState;
    (function (StickyState) {
        StickyState[StickyState["NOSTICKY"] = 0] = "NOSTICKY";
        StickyState[StickyState["ARMING"] = 1] = "ARMING";
        StickyState[StickyState["ARMED"] = 2] = "ARMED";
        StickyState[StickyState["BLOCKED"] = 3] = "BLOCKED";
    })(StickyState || (StickyState = {}));
    // in order, according to state types
    const StickyPanelClasses = new Map([
        [StickyState.NOSTICKY, 'sticky-panel--nosticky'],
        [StickyState.ARMING, 'sticky-panel--sticky-arming'],
        [StickyState.ARMED, 'sticky-panel--sticky-armed'],
        [StickyState.BLOCKED, 'sticky-panel--sticky-blocked']
    ]);
    class Component {
        static onStickyPanelStateChanged(stickyPanel, state, prevstate) {
            stickyPanel.AddClass(StickyPanelClasses[state]);
            switch (state) {
                case StickyState.ARMED:
                    // keep arming class to have a smooth transition
                    if (prevstate !== StickyState.ARMING)
                        stickyPanel.RemoveClass(StickyPanelClasses[prevstate]);
                    break;
                case StickyState.ARMING:
                case StickyState.BLOCKED:
                    stickyPanel.RemoveClass(StickyPanelClasses[prevstate]);
                    break;
                case StickyState.NOSTICKY:
                default:
                    // remove all classes except the no sticky one
                    [...StickyPanelClasses.values()]
                        .filter((spClass) => spClass !== StickyPanelClasses[0])
                        .forEach((spClass) => stickyPanel.RemoveClass(spClass));
                    break;
            }
        }
        static {
            $.RegisterEventHandler('OnStickyPanelStateChanged', $.GetContextPanel(), this.onStickyPanelStateChanged);
        }
    }
})(StickyCount || (StickyCount = {}));
