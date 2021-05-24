"use strict";

class MainMenuNews {
	static feed;
	
	static getNewsRSS() {
		NewsAPI.GetRSSFeed();
	}

	// Gets called once the RSS feed is loaded
	// If not called, means that there was an error
	static onRSSFeedReceived(feed) {
		MainMenuNews.feed = feed;
		if (feed.items.length > 0) {
			const item = MainMenuNews.feed.items[0]
			$.Msg(item);
			$('#LatestUpdateDetails').SetDialogVariable('title', item.title);
			$('#LatestUpdateDetails').SetDialogVariable('description', item.description);
			$('#LatestUpdateDetails').SetDialogVariable('date', item.date);
			$('#LatestUpdateDetails').SetDialogVariable('author', item.author);
			$('#LatestUpdateImage').SetImage(item.image);
			
			const btn = $.CreatePanel( 'Panel', $.FindChildInContext( '#LearnMoreParent' ), 'LearnMorePanel', {
				acceptsinput: true,
				onactivate: 'SteamOverlayAPI.OpenURLModal( "' + item.link + '" );',
				class: 'full-width'
			} );
			btn.LoadLayoutSnippet( 'news-learn-more' );
		}
		
		if (feed.items.length > 1) {
			const container = $.GetContextPanel().FindChildInLayoutFile( 'OtherUpdates' );

			if ( container === undefined || container === null )
				return;

			container.RemoveAndDeleteChildren();

			// Show max of 10 update previews
			feed.items.slice(1, 11).forEach( function( item, i ) {
				const entry = $.CreatePanel( 'Panel', container, 'NewsEntry' + i, {
					acceptsinput: true,
					onactivate: 'SteamOverlayAPI.OpenURLModal( "' + item.link + '" );',
					class: 'news-preview-panel'
				} );
				entry.LoadLayoutSnippet( 'news-update-preview' );
				entry.FindChildInLayoutFile( 'NewsUpdatePreview' ).SetImage( item.image );
			} );
		}
	}
	
	static setSelectedItem(index) {
	}
}

//--------------------------------------------------------------------------------------------------
// Entry point called when panel is created
//--------------------------------------------------------------------------------------------------
(function() {
	$.RegisterForUnhandledEvent( 'PanoramaComponent_News_OnRSSFeedReceived', MainMenuNews.onRSSFeedReceived );

	MainMenuNews.getNewsRSS();
})();
