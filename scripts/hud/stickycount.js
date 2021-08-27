'use_strict';

const StickyStateType = {
	NoSticky: 0,
	Arming: 1,
	Armed: 2,
	Blocked: 3
};

// in order, according to state types
const StickyPanelClasses = [
	'no-sticky',
	'sticky-arming',
	'sticky-armed',
	'sticky-blocked'
];

class StickyCount {
	static onStickyPanelStateChanged( stickyPanel, state, prevstate ) {
        stickyPanel.AddClass( StickyPanelClasses[state] );
		switch( state ) {
			case StickyStateType.Armed:
				// keep arming class to have a smooth transition
				if ( prevstate !== StickyStateType.Arming )
					stickyPanel.RemoveClass( StickyPanelClasses[prevstate] );
				break;
			case StickyStateType.Arming:
			case StickyStateType.Blocked:
				stickyPanel.RemoveClass( StickyPanelClasses[prevstate] );
				break;
			case StickyStateType.NoSticky:
			default:
                // remove all classes except the no sticky one
				StickyPanelClasses.filter( ( spClass ) => spClass !== StickyPanelClasses[0] )
					.forEach( ( spClass ) => stickyPanel.RemoveClass( spClass ) );
				break;
		}
	}
}

( function() {
	$.RegisterEventHandler( 'OnStickyPanelStateChanged', $.GetContextPanel(), StickyCount.onStickyPanelStateChanged );
})();
