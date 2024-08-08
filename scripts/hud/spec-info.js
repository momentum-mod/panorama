class HudSpecInfo {
	/** @type {Panel} @static */
container = $('#SpecInfoContainer');
	/** @type {Panel} @static */
namesContainer = $('#NamesContainer');
	/** @type {Label} @static */
numSpecLabel = $('#NumSpecLabel');

maxNames = 0;

onSpectatorTargetChanged(_type) {
		this.onSpectatorChanged();
	}

onSpectatorChanged() {
		const specList = SpectatorAPI.GetSpecList();

		const specCount = specList.length;
		if (specCount > 0) {
			this.container.visible = true;
			$.GetContextPanel().SetDialogVariableInt('numspec', specCount);
		} else this.container.visible = false;

		// 0 max names means there is no max
		const maxDisplayNames = this.maxNames > specCount || this.maxNames === 0 ? specCount : this.maxNames;

		this.namesContainer.RemoveAndDeleteChildren();
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

createSpecNameLabel(text) {
		const snippetCont = $.CreatePanel('Panel', this.namesContainer, '');
		snippetCont.LoadLayoutSnippet('specinfo-list-entry');

		/** @type {Label} */
		const nameLabel = snippetCont.FindChildInLayoutFile('FriendlySpecName');

		nameLabel.text = text;
	}

onMaxNamesChanged(maxNames) {
		this.maxNames = maxNames;
		this.onSpectatorChanged();
	}

onLoad() {
		this.maxNames = GameInterfaceAPI.GetSettingInt('mom_hud_specinfo_names_count');
	}

constructor() {
		$.RegisterForUnhandledEvent('MomentumSpectatorTargetChanged', this.onSpectatorTargetChanged.bind(this));
		$.RegisterForUnhandledEvent('MomentumSpectatorUpdate', this.onSpectatorChanged.bind(this));
		$.RegisterForUnhandledEvent('MomentumSpecListMaxNamesUpdate', this.onMaxNamesChanged.bind(this));

		$.GetContextPanel().SetDialogVariableInt('numspec', 0);
		this.container.visible = false;
	}
}
