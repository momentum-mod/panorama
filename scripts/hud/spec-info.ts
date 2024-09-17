import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler()
class HudSpecInfoHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<MomHudSpecInfo>(),
		container: $<Panel>('#SpecInfoContainer'),
		namesContainer: $<Panel>('#NamesContainer'),
		numSpecLabel: $<Label>('#NumSpecLabel')
	};

	maxNames = GameInterfaceAPI.GetSettingInt('mom_hud_specinfo_names_count');

	constructor() {
		$.RegisterForUnhandledEvent('ObserverTargetChanged', () => this.onSpectatorChanged());
		$.RegisterForUnhandledEvent('MomentumSpectatorUpdate', () => this.onSpectatorChanged());
		$.RegisterForUnhandledEvent('MomentumSpecListMaxNamesUpdate', (val) => {
			this.maxNames = val;
			this.onSpectatorChanged();
		});
	}

	onPanelLoad() {
		this.panels.cp.SetDialogVariableInt('numspec', 0);
		this.panels.container.visible = false;
	}

	onSpectatorChanged() {
		const specList = SpectatorAPI.GetSpecList();

		const specCount = specList.length;
		if (specCount > 0) {
			this.panels.container.visible = true;
			$.GetContextPanel().SetDialogVariableInt('numspec', specCount);
		} else {
			this.panels.container.visible = false;
		}

		// 0 max names means there is no max
		const maxDisplayNames = this.maxNames > specCount || this.maxNames === 0 ? specCount : this.maxNames;

		this.panels.namesContainer.RemoveAndDeleteChildren();
		for (let i = 0; i < maxDisplayNames; i++) {
			const steamID = specList[i];
			const friendlyName = FriendsAPI.GetNameForXUID(steamID);
			// perhaps display more info than just the friendly name

			this.createSpecNameLabel(friendlyName);
		}

		// full list was truncated so make that apparent
		if (maxDisplayNames < specCount) {
			this.createSpecNameLabel('...');
		}
	}

	createSpecNameLabel(text: string) {
		const snippetCont = $.CreatePanel('Panel', this.panels.namesContainer, '');
		snippetCont.LoadLayoutSnippet('specinfo-list-entry');

		const nameLabel = snippetCont.FindChildInLayoutFile<Label>('FriendlySpecName');
		nameLabel.text = text;
	}
}
