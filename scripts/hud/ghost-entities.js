class GhostEntities {
	static onAimOverGhostChange(entPanel, aimOver) {
		const nameEnabled = $.GetContextPanel().ghostNamesEnabled && aimOver;
		const namePanel = entPanel.FindChildTraverse('NamePanel');
		namePanel.SetHasClass('ghost-ent-namepanel--hidden', !nameEnabled);

		// Always keep centered even when name isn't visible
		if (nameEnabled) {
			entPanel.style.transform = 'translatex(0)';
			entPanel.style.zIndex = 1;
		} else {
			const nameLabel = namePanel.FindChildTraverse('GhostName');
			entPanel.style.transform = `translatex(${nameLabel.actuallayoutwidth / nameLabel.actualuiscale_x / 2}px)`;
			entPanel.style.zIndex = 0;
		}
	}

	static {
		$.RegisterForUnhandledEvent('OnAimOverGhostChange', this.onAimOverGhostChange);
	}
}
