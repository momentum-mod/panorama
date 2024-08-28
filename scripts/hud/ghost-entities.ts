import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class GhostEntitiesHandler {
	constructor() {
		$.RegisterForUnhandledEvent('OnAimOverGhostChange', (panel, aimOver) =>
			this.onAimOverGhostChange(panel, aimOver)
		);
	}

	onAimOverGhostChange(entPanel: MomHudGhostEntityPanel, aimOver: boolean) {
		const nameEnabled = $.GetContextPanel<MomHudGhostEntities>().ghostNamesEnabled && aimOver;
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
}
