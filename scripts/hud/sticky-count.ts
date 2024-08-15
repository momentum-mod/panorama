const STICKY_STATE_TYPE = {
	NOSTICKY: 0,
	ARMING: 1,
	ARMED: 2,
	BLOCKED: 3
};

// in order, according to state types
const StickyPanelClasses = [
	'sticky-panel--nosticky',
	'sticky-panel--sticky-arming',
	'sticky-panel--sticky-armed',
	'sticky-panel--sticky-blocked'
];

class StickyCount {
	static onStickyPanelStateChanged(stickyPanel, state, prevstate) {
		stickyPanel.AddClass(StickyPanelClasses[state]);
		switch (state) {
			case STICKY_STATE_TYPE.ARMED:
				// keep arming class to have a smooth transition
				if (prevstate !== STICKY_STATE_TYPE.ARMING) stickyPanel.RemoveClass(StickyPanelClasses[prevstate]);
				break;
			case STICKY_STATE_TYPE.ARMING:
			case STICKY_STATE_TYPE.BLOCKED:
				stickyPanel.RemoveClass(StickyPanelClasses[prevstate]);
				break;
			case STICKY_STATE_TYPE.NOSTICKY:
			default:
				// remove all classes except the no sticky one
				for (const spClass of StickyPanelClasses.filter((spClass) => spClass !== StickyPanelClasses[0]))
					stickyPanel.RemoveClass(spClass);
				break;
		}
	}

	static {
		$.RegisterEventHandler('OnStickyPanelStateChanged', $.GetContextPanel(), this.onStickyPanelStateChanged);
	}
}
