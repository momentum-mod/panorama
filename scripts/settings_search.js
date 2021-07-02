'use strict';

class SettingsMenuSearch {

	static searchTextEntry = $( '#SettingsSearchTextEntry' );
	static clearButton = $( '#SettingsSearchClear' );
	static results;

	static Init() 
	{
		$.RegisterEventHandler('ReadyForDisplay', this.searchTextEntry, function () {
			this.searchTextEntry.SetFocus();
			this.searchTextEntry.RaiseChangeEvents(true);
		});
		$.RegisterEventHandler('UnreadyForDisplay', this.searchTextEntry, function () {
			this.searchTextEntry.SetFocus();
			this.searchTextEntry.RaiseChangeEvents(false);
		});

		this.searchTextEntry.RegisterForReadyEvents(true);
		this.searchTextEntry.SetReadyForDisplay(true);

		this.searchTextEntry.SetPanelEvent('ontextentrychange', this.OnTextEntryChanged);

		this.clearButton.visible = false;
	}

	static OnTextEntryChanged() 
	{
		var hasText = /.*\S.*/;
		if (!hasText.test(SettingsMenuSearch.searchTextEntry.text)) 
		{
			MainMenuSettings.navigateToTab('InputSettings');

			SettingsMenuSearch.clearButton.visible = false;

			return;
		}

		SettingsMenuSearch.clearButton.visible = true;

		MainMenuSettings.navigateToTab('SearchSettings');

		SettingsMenuSearch.resultsContainer = $('#SearchResultsContainer');

		const parentPanel = $('#SettingsMenuContent');
		const resultsPanel = parentPanel.FindChildTraverse('SearchResultsContainer');
		resultsPanel.RemoveAndDeleteChildren();

		SettingsMenuSearch.results = resultsPanel;

		var arrStrings = SettingsMenuSearch.searchTextEntry.text.split(/\s/).filter(s => /^\w+$/.test(s));

		var arrMatches = [];
		var curMenuTab = null;

		Object.keys(MainMenuSettings.settingsTabs).forEach(id => {
			curMenuTab = id;
			var rootPanel = parentPanel.FindChildTraverse(id);

			TraverseChildren(rootPanel, SearchSettingText);

			function TraverseChildren(root, searchFn) {
				if (typeof root.Children !== 'function') return;
				root.Children().forEach(c => {
					TraverseChildren(c, searchFn);
					searchFn(c);
				});
			}

			function SearchSettingText(settingPanel) 
			{
				if (ShouldSearchPanelText(settingPanel)) 
				{
					var bPass = arrStrings.every(s => {
						var search = new RegExp(s, "giu");
						return search.test(settingPanel.text);
					});

					if (bPass) 
					{
						var parent = settingPanel.GetParent();
						var panel = (parent.paneltype === 'ChaosSettingsEnum' ||
							parent.paneltype === 'ChaosSettingsSlider' ||
							parent.paneltype === 'ChaosSettingsEnumDropdown' ||
							parent.paneltype === 'ChaosSettingsKeyBinder' ||
							parent.parentPanel === 'ChaosSettingsToggle') ? parent : parent.GetParent();
						arrMatches.push({
							panel: panel,
							text: settingPanel.text,
							menu: curMenuTab
						});
					}
				}

				function ShouldSearchPanelText(setting) 
				{
					if (!setting.hasOwnProperty('text'))
						return false;

					if (setting.paneltype === 'TextEntry')
						return false;

					if (setting.HasClass('DropDownChild'))
						return false;

					if (setting.HasClass('BindingRowButton'))
						return false;

					if (setting.HasClass('header') || setting.HasClass('settings-subheader'))
						return false;

					if (setting.GetParent().paneltype === ('RadioButton'))
						return false;

					return true;
				}
			}
		});

		arrMatches.forEach(searchResult => {
			SettingsMenuSearch.CreateSearchResultPanel(searchResult.text, searchResult.menu, searchResult.panel);
		});
	}

	static CreateSearchResultPanel(text, menuid, panel) 
	{
		var searchResult = $.CreatePanel("Panel", SettingsMenuSearch.results, '');
		if (searchResult.LoadLayoutSnippet("SearchResult")) 
		{
			searchResult.FindChild("ResultString").SetProceduralTextThatIPromiseIsLocalizedAndEscaped(text, true);
			searchResult.SetPanelEvent('onactivate', function () {
				SettingsMenuSearch.ClearSearch();
				// This is confusing me. I'm not sure why it has to be an event (I'm doing what CSGO does), but just calling navigateToSettingPanel
				// from here doesn't pass in the arguments 
				$.DispatchEvent("MainMenuSettings_navigateToSettingPanel", menuid, panel);
			});
		}
	}

	static ClearSearch() 
	{
		SettingsMenuSearch.searchTextEntry.text = '';
	}
}
              
(function ()
{
	SettingsMenuSearch.Init();
	$.RegisterForUnhandledEvent( 'MainMenuSettings_navigateToSettingPanel',  MainMenuSettings.navigateToSettingPanel );
})();