const POST_MAX_CHARS = 1024;

class MainMenuNews {
	static panels = {
		/** @type {Image} @static */
		latestUpdateImage: $('#LatestUpdateImage'),
		/** @type {Button} @static */
		learnMore: $('#LearnMore'),
		/** @type {Panel} @static */
		otherUpdates: $('#OtherUpdates')
	};

	static feed;

	static {
		$.RegisterForUnhandledEvent('PanoramaComponent_News_OnRSSFeedReceived', this.onRSSFeedReceived.bind(this));

		this.getNewsRSS();
	}

	static getNewsRSS() {
		NewsAPI.GetRSSFeed();
	}

	/**
	 * Gets called once the RSS feed is loaded
	 * If not called, means that there was an error
	 * @param {Object} feed - JSON data from RSS
	 */
	static onRSSFeedReceived(feed) {
		this.feed = feed;

		if (feed.items.length > 0) {
			const cp = $.GetContextPanel();
			const item = MainMenuNews.feed.items[0];

			let desc;
			if (item.description.length > POST_MAX_CHARS) {
				desc = item.description.slice(0, POST_MAX_CHARS);

				// Check we're not inside a tag
				if ((desc.includes('<') && desc.match(/</g)).length !== desc.match(/>/g).length) {
					desc = desc.slice(0, desc.lastIndexOf('<'));
				}
			} else {
				desc = item.description;
			}

			cp.SetDialogVariable('title', item.title);
			cp.SetDialogVariable('description', desc);
			cp.SetDialogVariable('date', item.date);
			cp.SetDialogVariable('author', item.author);

			this.panels.latestUpdateImage.SetImage(item.image);
			this.panels.latestUpdateImage.SetPanelEvent('onactivate', () => SteamOverlayAPI.OpenURLModal(item.link));
			this.panels.learnMore.SetPanelEvent('onactivate', () => SteamOverlayAPI.OpenURLModal(item.link));
		}

		if (feed.items.length > 1) {
			this.panels.otherUpdates.RemoveAndDeleteChildren();

			// Show max of 10 update previews
			for (const [i, item] of feed.items.slice(1, 11).entries()) {
				const entry = $.CreatePanel('Image', this.panels.otherUpdates, 'NewsEntry' + i, {
					acceptsinput: true,
					class: 'news__other-item news__other-image'
				});
				entry.SetPanelEvent('onactivate', () => SteamOverlayAPI.OpenURLModal(item.link));
				// entry.LoadLayoutSnippet('news-update-preview');
				entry.SetImage(item.image);
			}
		}
	}

	static minimize() {
		$.GetContextPanel().ToggleClass('news--minimized');
	}
}
