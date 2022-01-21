'use strict';

class GhostEntities {
	static onAimOverGhostChange(entpanel, aimover) {
		const nameEnabled = $.GetContextPanel().ghostNamesEnabled && aimover;
		let namePanel = entpanel.FindChildTraverse('NamePanel');
		namePanel.SetHasClass('ghost-ent-namepanel--hidden', !nameEnabled);

		// always keep centered even when name isnt visible
		if (nameEnabled)
		{
			entpanel.style.transform = 'translatex(0)';
		}
		else
		{
			const nameLabel = namePanel.FindChildTraverse('GhostName');
			entpanel.style.transform = `translatex(${nameLabel.actuallayoutwidth / nameLabel.actualuiscale_x / 2}px)`;
		}
	}

	static {
		$.RegisterForUnhandledEvent('OnAimOverGhostChange', this.onAimOverGhostChange);
	}
}
