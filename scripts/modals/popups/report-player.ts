import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

import ReportCategory = MomentumAPI.ReportCategory;

@PanelHandler()
class ReportPlayerHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<Panel>(),
		message: $<TextEntry>('#ReportMessage'),
		submitButton: $<Button>('#SubmitButton')
	};

	steamID: steamID = '';

	onPanelLoad() {
		this.steamID = this.panels.cp.GetAttributeString('steamid', '');

		// Replacement passed as a function so $-sequences in the player's name
		// (e.g. 'cheap$$$skate') aren't interpreted as replace() pattern syntax.
		this.panels.cp.SetDialogVariable(
			'subtitle',
			$.Localize('#Report_Player_Subtitle').replace('%player%', () => FriendsAPI.GetNameForXUID(this.steamID))
		);

		this.onChanged();
	}

	onChanged() {
		// A report is only useful if they've actually explained what happened
		this.panels.submitButton.enabled = this.panels.message.text.trim().length > 0;
	}

	submit() {
		if (!this.steamID) return;

		// TODO: Add report category for voice or text chat?
		MomentumAPI.ReportPlayer(this.steamID, ReportCategory.OTHER, this.panels.message.text.trim());

		UiToolkitAPI.CloseAllVisiblePopups();
	}

	cancel() {
		UiToolkitAPI.CloseAllVisiblePopups();
	}
}
