const MAX_MATCHES = 16;

class SettingsSearch {
	static panels = {
		/** @type {Panel} @static */
		content: $('#SettingsContent'),
		/** @type {TextEntry} @static */
		searchTextEntry: $('#SettingsSearchTextEntry'),
		/** @type {Button} @static */
		clearButton: $('#SettingsSearchClear'),
		/** @type {Panel} @static */
		results: null,
		/** @type {Panel} @static */
		emptyContainer: null
	};

	/** @type {string[]} @static */
	static strings = [];

	static matches = [];

	static {
		this.panels.searchTextEntry.SetPanelEvent('ontextentrychange', this.onTextEntryChanged.bind(this));
	}

	static onTextEntryChanged() {
		// Check textentry is not empty
		if (!/.*\S.*/.test(this.panels.searchTextEntry.text)) {
			MainMenuSettings.navigateToTab(MainMenuSettings.prevTab);

			this.panels.clearButton.AddClass('search__clearbutton--hidden');

			return;
		}

		// Show the clear button
		this.panels.clearButton.RemoveClass('search__clearbutton--hidden');

		// Switch to search tab
		MainMenuSettings.navigateToTab('SearchSettings');

		this.panels.results ??= this.panels.content.FindChildTraverse('SearchResultsContainer');
		this.panels.emptyContainer ??= this.panels.content.FindChildTraverse('SettingsEmptyContainer');

		// Clear existing results
		this.panels.results.RemoveAndDeleteChildren();

		// Split into individual words
		this.strings = this.panels.searchTextEntry.text.split(/\s/).filter((s) => /^\w+$/.test(s));

		// Don't bother show anything if we only have one char words, can spawn hundreds of panels.
		if (!this.strings.some((str) => str.length > 1)) return;

		// Initialise matches array
		this.matches = [];

		// Search through each page
		for (const tabID of Object.keys(SettingsTabs)) {
			const tabPanel = this.panels.content.FindChildTraverse(tabID);
			const tabName = $.Localize(tabPanel.GetFirstChild().GetFirstChild().text);
			this.traverseChildren(tabID, this.panels.content.FindChildTraverse(tabID), tabName, null, null);
		}

		// Populate results panel with matches
		if (this.matches.length > 0)
			for (const matchingPanel of this.matches) this.createSearchResultPanel(matchingPanel);
		else {
			$.CreatePanel('Label', this.panels.results, '', {
				class: 'settings-search__empty-header',
				text: $.Localize('#Settings_General_Search_EmptyHeader')
			});
			$.CreatePanel('Label', this.panels.results, '', {
				class: 'settings-search__empty-para',
				text: $.Localize('#Settings_General_Search_EmptyNoResults')
			});
		}
	}

	static traverseChildren(tabID, panel, tabName, groupName, groupTags) {
		// At some point in traversal we should hit the settings-group panels. Once we do, for a class traverse to
		// dig out the title panel. Class traverse is probably quite slow but this doesn't get run as often as
		// everything else.
		if (panel.HasClass('settings-group')) {
			const titlePanel = panel.FindChildrenWithClassTraverse('settings-group__title')[0];

			if (titlePanel) {
				groupName = $.Localize(titlePanel.text);
				groupTags = titlePanel.GetAttributeString('tags', '')?.split(',');
			}
		}

		for (const child of panel?.Children() ?? []) {
			if (this.shouldSearchPanelText(child)) this.searchSettingText(tabID, child, tabName, groupName, groupTags);
			this.traverseChildren(tabID, child, tabName, groupName, groupTags);
		}
	}

	static searchSettingText(tabID, textPanel, tabName, groupName, groupTags) {
		// ChaosSettings* panels have embed structure that the traversal searches inside of to dig out a
		// .text property match. So, navigate back up to find the actual setting panel.
		const parent = textPanel.GetParent();
		const panel =
			MainMenuSettings.isSettingsPanel(parent) || parent.paneltype === 'ConVarEnabler'
				? parent
				: parent.GetParent();

		const tags = panel.GetAttributeString('tags', '')?.split(',');

		let allMatched = true;

		const matches = {};

		for (const inputString of this.strings) {
			if (!inputString) {
				allMatched = false;
				break;
			}

			let matched = false;
			const inputStringMatches = [];

			if (this.findMatch(inputStringMatches, inputString, $.Localize(textPanel.text), MatchType.SETTING_TEXT))
				matched = true;
			if (this.findMatch(inputStringMatches, inputString, groupName, MatchType.GROUP_TEXT)) matched = true;
			if (tags)
				for (let i = 0; i < tags.length; i++)
					if (this.findMatch(inputStringMatches, inputString, tags[i], MatchType.SETTING_TAG, i))
						matched = true;
			if (groupTags)
				for (let i = 0; i < groupTags.length; i++)
					if (this.findMatch(inputStringMatches, inputString, groupTags[i], MatchType.GROUP_TAG, i))
						matched = true;

			if (!matched) allMatched = false;

			matches[inputString] = inputStringMatches;
		}

		if (!allMatched) return;

		const text = textPanel.HasClass('settings-group__title') ? '' : $.Localize(textPanel.text);

		this.matches.push({
			panel: panel,
			text: text,
			tags: tags,
			tabName: tabName,
			groupName: groupName,
			tabID: tabID,
			groupTags: groupTags,
			matches: matches
		});
	}

	static findMatch(inputStringMatches, inputString, testString, type, tagIndex) {
		if (!testString) return false;

		const testLowerCase = testString.toLowerCase();
		const index = testLowerCase.indexOf(inputString.toLowerCase());

		if (index === -1 || (index > 0 && testLowerCase[index - 1] !== ' ')) return false;

		inputStringMatches.push({
			type: type,
			testString: testString,
			tagIndex: tagIndex
		});

		return true;
	}

	// Only check text on panels that have a text property, ignore dropdowns, headers, keybinder keys, radiobutton text
	static shouldSearchPanelText(panel) {
		return (
			Object.hasOwn(panel, 'text') &&
			panel.paneltype !== 'TextEntry' &&
			panel.GetParent().paneltype !== 'Button' &&
			!panel.HasClass('DropDownChild') &&
			!panel.HasClass('settings-keybinder__key') &&
			!panel.HasClass('settings-group__header') &&
			!panel.HasClass('settings-group__subtitle') &&
			!panel.HasClass('settings-page__title') &&
			panel.GetParent().paneltype !== 'RadioButton'
		);
	}

	/**
	 * Create a panel for a search result
	 * @param {MatchingPanel} matches
	 */
	static createSearchResultPanel(matches) {
		if (this.panels.results.Children().length >= MAX_MATCHES) {
			if (this.panels.results.Children().length === MAX_MATCHES)
				$.CreatePanel('Label', this.panels.results, '', {
					class: 'settings-search__empty-para',
					text: $.Localize('#Settings_General_Search_VeryFull')
				});
			return;
		}

		const searchResult = $.CreatePanel('Panel', this.panels.results, '');

		// If the text property is set, we're targeting an individual setting. Otherwise, a group.
		const isGroupPanel = !matches.text;

		if (!searchResult.LoadLayoutSnippet(isGroupPanel ? 'GroupSearchResult' : 'FullSearchResult')) return;

		let groupName = matches.groupName;
		let name = matches.text;
		const tags = [];
		const groupTags = [];

		for (const [inputString, m] of Object.entries(matches.matches ?? {}))
			for (const match of m) {
				if (match.type === MatchType.GROUP_TEXT)
					groupName = groupName.replace(
						new RegExp(`(${inputString})`, 'ig'),
						'<font class="settings-search-result__text--match">$1</font>'
					);

				if (match.type === MatchType.SETTING_TEXT)
					name = name.replace(
						new RegExp(`(${inputString})`, 'ig'),
						'<font class="settings-search-result__text--match">$1</font>'
					);

				if (match.type === MatchType.SETTING_TAG) {
					$.Msg(`matches.tags: ${matches.tags}, tagindex: ${match.tagIndex}, inptustring: ${inputString}`);
					tags.push(
						matches.tags[match.tagIndex]?.replace(
							new RegExp(`(${inputString})`, 'ig'),
							'<font class="settings-search-result__tags--match">$1</font>'
						)
					);
				}

				if (match.type === MatchType.GROUP_TAG)
					groupTags.push(
						matches.groupTags[match.tagIndex]?.replace(
							new RegExp(`(${inputString})`, 'ig'),
							'<font class="settings-search-result__tags--match">$1</font>'
						)
					);
			}

		searchResult.SetDialogVariable('tab_name', matches.tabName);
		searchResult.FindChild('Group').text = groupName;
		if (!isGroupPanel) searchResult.FindChild('Text').text = name;

		const tagList = searchResult.FindChild('Tags');

		if (tags.length > 0 || groupTags.length > 0)
			tagList.text =
				$.Localize('#Settings_General_Search_MatchedEnglishTag') +
				[...new Set([...groupTags, ...tags])].join(', ');
		else tagList.AddClass('settings-search-result__tags--hidden');

		searchResult.SetPanelEvent('onactivate', () => {
			this.clearSearch();
			$.DispatchEvent('SettingsNavigateToPanel', matches.tabID, matches.panel);
		});
	}

	static clearSearch() {
		this.panels.searchTextEntry.text = '';
	}
}

const MatchType = {
	SETTING_TEXT: 0,
	SETTING_TAG: 1,
	GROUP_TEXT: 2,
	GROUP_TAG: 3
};
