'use strict';

class SettingsSearch {
	static searchTextEntry = $('#SettingsSearchTextEntry');
	static clearButton = $('#SettingsSearchClear');
	static results;

	static {
		SettingsSearch.searchTextEntry.SetPanelEvent('ontextentrychange', SettingsSearch.onTextEntryChanged);
	}

	static onTextEntryChanged() {
		// Check textentry is not empty
		if (!/.*\S.*/.test(SettingsSearch.searchTextEntry.text)) {
			MainMenuSettings.navigateToTab(MainMenuSettings.prevTab);

			SettingsSearch.clearButton.AddClass('search__clearbutton--hidden');

			return;
		}

		// Show the clear button
		SettingsSearch.clearButton.RemoveClass('search__clearbutton--hidden');

		// Switch to search tab
		MainMenuSettings.navigateToTab('SearchSettings');

		const parentPanel = $('#SettingsContent');
		const resultsPanel = parentPanel.FindChildTraverse('SearchResultsContainer');

		// Clear existing results
		resultsPanel.RemoveAndDeleteChildren();

		SettingsSearch.results = resultsPanel;

		// Split into individual words
		const arrStrings = SettingsSearch.searchTextEntry.text.split(/\s/).filter((s) => /^\w+$/.test(s));

		// Initalise matches array
		let arrMatches = [];

		// Search through each page
		Object.keys(MainMenuSettings.settingsTabs).forEach((tabID) => {
			const traverseChildren = (panel) =>
				panel.Children()?.forEach((child) => {
					SettingsSearch.searchSettingText(tabID, child, arrMatches, arrStrings);
					traverseChildren(child);
				});

			traverseChildren(parentPanel.FindChildTraverse(tabID));
		});

		// Populate results panel with matches
		arrMatches.forEach((searchResult) => SettingsSearch.createSearchResultPanel(searchResult.text, searchResult.menu, searchResult.panel));
	}

	static searchSettingText(tabID, settingPanel, arrMatches, arrStrings) {
		if (!SettingsSearch.shouldSearchPanelText(settingPanel)) return;

		// Check every string is in this panel's text value
		if (arrStrings.every((s) => new RegExp(s, 'giu').test(settingPanel.text))) {
			const parent = settingPanel.GetParent();
			// ChaosSettingsEnum has
			const panel = MainMenuSettings.isSettingsPanel(parent) || parent.paneltype === 'ConVarEnabler' ? parent : parent.GetParent();

			arrMatches.push({
				panel: panel,
				text: settingPanel.text,
				menu: tabID
			});
		}
	}

	// Only check text on panels that have a text property, ignore dropdowns, headers, keybinder keys, radiobutton text
	static shouldSearchPanelText(panel) {
		if (!panel.hasOwnProperty('text')) return false;

		if (panel.paneltype === 'TextEntry') return false;

		if (panel.HasClass('DropDownChild')) return false;

		if (panel.HasClass('settings-keybinder__key')) return false;

		if (panel.HasClass('settings-group__title') || panel.HasClass('settings-group__subtitle') || panel.HasClass('settings-page__title')) return false;

		if (panel.GetParent().paneltype === 'RadioButton') return false;

		return true;
	}

	// Create a panel for a search result
	static createSearchResultPanel(text, tabID, panel) {
		var searchResult = $.CreatePanel('Panel', this.results, '');

		if (searchResult.LoadLayoutSnippet('SearchResult')) {
			searchResult.FindChild('ResultString').SetProceduralTextThatIPromiseIsLocalizedAndEscaped(text, true);

			searchResult.SetPanelEvent('onactivate', function () {
				SettingsSearch.clearSearch();
				$.DispatchEvent('SettingsNavigateToPanel', tabID, panel);
			});
		}
	}

	static clearSearch() {
		SettingsSearch.searchTextEntry.text = '';
	}
}
