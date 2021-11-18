'use strict';

class GhostEntities {
	static onAimOverGhostChange( entpanel, aimover ) {
		let nameEnabled = $.GetContextPanel().ghostNamesEnabled && aimover;
		let namePanel = entpanel.FindChildTraverse( 'NamePanel' );
		namePanel.SetHasClass( 'namepanel--hidden', !nameEnabled );

		// always keep centered even when name isnt visible
		if ( nameEnabled )
		{
			entpanel.style.transform = 'translatex( 0 )';
		}
		else
		{
			let nameLabel = namePanel.FindChildTraverse( 'GhostName' );
			entpanel.style.transform = `translatex( ${ nameLabel.actuallayoutwidth / nameLabel.actualuiscale_x / 2 }px )`;
		}
	}

	static {
		$.RegisterForUnhandledEvent('OnAimOverGhostChange', GhostEntities.onAimOverGhostChange);
	}
}
