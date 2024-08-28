import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class NewsHandler {
	readonly panels = {
		latestUpdateImage: $<Image>('#LatestUpdateImage'),
		learnMore: $<Button>('#LearnMore'),
		otherUpdates: $<Panel>('#OtherUpdates')
	};

	readonly postMaxChars = 1024;

	constructor() {
		$.RegisterForUnhandledEvent('PanoramaComponent_News_OnRSSFeedReceived', (items) =>
			this.onRSSFeedReceived(items)
		);

		NewsAPI.GetRSSFeed();
	}

	/**
	 * Gets called once the RSS feed is loaded
	 * If not called, means that there was an error
	 * @param {Object} feed - JSON data from RSS
	 */
	onRSSFeedReceived(feed: { items: NewsAPI.RSSFeedItem[] }) {
		if (feed.items.length === 0) {
			return;
		}

		const cp = $.GetContextPanel();
		const item = feed.items[0];

		let desc;
		if (item.description.length > this.postMaxChars) {
			desc = item.description.slice(0, this.postMaxChars);

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

		if (feed.items.length === 1) {
			return;
		}

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

	minimize() {
		$.GetContextPanel().ToggleClass('news--minimized');
	}
}
