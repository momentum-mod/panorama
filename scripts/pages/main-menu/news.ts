import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class NewsHandler {
	readonly panels = {
		latestUpdateImage: $<Image>('#LatestUpdateImage'),
		learnMore: $<Button>('#LearnMore'),
		otherUpdates: $<Panel>('#OtherUpdates')
	};

	readonly maxDescriptionLength = 2048;

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

		let desc = item.description;

		// Limit description length by at most maxDescriptionLength
		if (desc.length > this.maxDescriptionLength) {
			desc = desc.slice(0, this.maxDescriptionLength);

			// Trim description to the last full list item, ensures we're not trimming inside of a tag,
			// and avoids ever showing an e.g. "Added" heading with no items below it.
			const lastLi = desc.lastIndexOf('</li>');
			if (lastLi > 0) {
				desc = desc.slice(0, lastLi + 5);
			} else {
				// Unlikely we ever had something without list items, at worst we could just have slightly buggy
				// text. Not worth trying to escape other bits of HTML, too complex.
			}

			// Not localizing since blog isn't translated either
			desc +=
				'<br><font class="news-latest__description__see-more">See the blog post on the right for more!</font>';
		}

		// Evil hacks to make description look decent -- Panorama's HTML parsing is garbage.
		desc = desc
			// <div>s aren't parsed!
			.replaceAll('<div class="bb_h2">', '<font class="news-latest__description__h2">')
			.replaceAll('</div>', '</font><br>')
			// <li>s just appends a unicode bullet point and whitespace, regular hyphen looks better.
			.replaceAll('<li>', '<font>- ')
			.replaceAll('</li>', '</font>')
			// <ul>s aren't parsed at all, better helpful for line breaks. Note that we can't use
			// margins here, they get ignored.
			.replaceAll('<ul>', '<br>')
			.replaceAll('</ul>', '<br><br>')
			// Replace backticks with <pre> tags
			.replace(/`([^`]+)`/g, '<pre>$1</pre>')
			// If a <pre> is followed by a regular whitespace, Panorama ignores it (????)
			.replaceAll('</pre> ', '</pre>&nbsp;');

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
