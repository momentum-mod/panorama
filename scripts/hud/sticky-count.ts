import { PanelHandler } from 'util/module-helpers';

export enum StickyState {
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

@PanelHandler()
class StickyCountHandler {
	constructor() {
		$.RegisterEventHandler('OnStickyPanelStateChanged', $.GetContextPanel(), this.onStickyPanelStateChanged);
	}

	onStickyPanelStateChanged(stickyPanel: Panel, state: StickyState, prevstate: StickyState) {
		stickyPanel.AddClass(StickyPanelClasses.get(state));
		switch (state) {
			case StickyState.ARMED:
				// keep arming class to have a smooth transition
				if (prevstate !== StickyState.ARMING) stickyPanel.RemoveClass(StickyPanelClasses.get(prevstate));
				break;
			case StickyState.ARMING:
			case StickyState.BLOCKED:
				stickyPanel.RemoveClass(StickyPanelClasses.get(prevstate));
				break;
			case StickyState.NOSTICKY:
			default:
				// remove all classes except the no sticky one
				// TODO: iterator methods
				[...StickyPanelClasses.values()]
					.filter((spClass) => spClass !== StickyPanelClasses.get(StickyState.NOSTICKY))
					.forEach((spClass) => stickyPanel.RemoveClass(spClass));
				break;
		}
	}
}
