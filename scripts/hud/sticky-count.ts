namespace StickyCount {
	enum StickyState {
		NOSTICKY = 0,
		ARMING = 1,
		ARMED = 2,
		BLOCKED = 3
	}

	// in order, according to state types
	const StickyPanelClasses = new Map([
		[StickyState.NOSTICKY, 'sticky-panel--nosticky'],
		[StickyState.ARMING, 'sticky-panel--sticky-arming'],
		[StickyState.ARMED, 'sticky-panel--sticky-armed'],
		[StickyState.BLOCKED, 'sticky-panel--sticky-blocked']
	]);

	class Component {
		static onStickyPanelStateChanged(stickyPanel: Panel, state: StickyState, prevstate: StickyState) {
			stickyPanel.AddClass(StickyPanelClasses[state]);
			switch (state) {
				case StickyState.ARMED:
					// keep arming class to have a smooth transition
					if (prevstate !== StickyState.ARMING) stickyPanel.RemoveClass(StickyPanelClasses[prevstate]);
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
}
