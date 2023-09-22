class HudSpecInfo {
	/** @type {Panel} @static */
	static container = $('#SpecInfoContainer');
	/** @type {Panel} @static */
	static namesContainer = $('#NamesContainer');
	/** @type {Label} @static */
	static numSpecLabel = $('#NumSpecLabel');

	static maxNames = 0;

	static onSpectatorTargetChanged(_type) {
		this.onSpectatorChanged();
	}

	static onSpectatorChanged() {
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

	static createSpecNameLabel(text) {
		const snippetCont = $.CreatePanel('Panel', this.namesContainer, '');
		snippetCont.LoadLayoutSnippet('specinfo-list-entry');

		/** @type {Label} */
		const nameLabel = snippetCont.FindChildInLayoutFile('FriendlySpecName');

		nameLabel.text = text;
	}

	static onMaxNamesChanged(maxNames) {
		this.maxNames = maxNames;
		this.onSpectatorChanged();
	}

	static onLoad() {
		this.maxNames = GameInterfaceAPI.GetSettingInt('mom_hud_specinfo_names_count');
	}

	static {
		$.RegisterForUnhandledEvent('MomentumSpectatorTargetChanged', this.onSpectatorTargetChanged.bind(this));
		$.RegisterForUnhandledEvent('MomentumSpectatorUpdate', this.onSpectatorChanged.bind(this));
		$.RegisterForUnhandledEvent('MomentumSpecListMaxNamesUpdate', this.onMaxNamesChanged.bind(this));

		$.GetContextPanel().SetDialogVariableInt('numspec', 0);
		this.container.visible = false;
	}
}
