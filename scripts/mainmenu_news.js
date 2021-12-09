'use strict';

const POST_MAX_CHARS = 1024;

class MainMenuNews {
	static feed;

	static {
		$.RegisterForUnhandledEvent('PanoramaComponent_News_OnRSSFeedReceived', MainMenuNews.onRSSFeedReceived);

		MainMenuNews.getNewsRSS();
	}

	static getNewsRSS() {
		NewsAPI.GetRSSFeed();
	}

	// Gets called once the RSS feed is loaded
	// If not called, means that there was an error
	static onRSSFeedReceived(feed) {
		MainMenuNews.feed = feed;
		if (feed.items.length > 0) {
			const cp = $.GetContextPanel();
			const item = MainMenuNews.feed.items[0];

			let desc;
			if (item.description.length > POST_MAX_CHARS) {
				desc = item.description.slice(0, POST_MAX_CHARS);

				// Check we're not inside a tag
				if ((desc.includes('<') && desc.match(/\</g)).length !== desc.match(/\>/g).length) {
					desc = desc.slice(0, desc.lastIndexOf('<'));
				}
			} else {
				desc = item.description;
			}

			cp.SetDialogVariable('title', item.title);
			cp.SetDialogVariable('description', desc);
			cp.SetDialogVariable('date', item.date);
			cp.SetDialogVariable('author', item.author);
			$('#LatestUpdateImage').SetImage(item.image);
			$('#LatestUpdateImage').SetPanelEvent('onactivate', () => SteamOverlayAPI.OpenURLModal(item.link));
			$('#LearnMore').SetPanelEvent('onactivate', () => SteamOverlayAPI.OpenURLModal(item.link));
		}

		if (feed.items.length > 1) {
			const container = $('#OtherUpdates');

			if (container === undefined || container === null) return;

			container.RemoveAndDeleteChildren();

			// Show max of 10 update previews
			feed.items.slice(1, 11).forEach((item, i) => {
				const entry = $.CreatePanel('Image', container, 'NewsEntry' + i, {
					acceptsinput: true,
					onactivate: 'SteamOverlayAPI.OpenURLModal( "' + item.link + '" );',
					class: 'news__other-item news__other-image'
				});
				// entry.LoadLayoutSnippet('news-update-preview');
				entry.SetImage(item.image);
			});
		}
	}

	static minimize() {
		$.GetContextPanel().ToggleClass('news--minimized');
	}
}
