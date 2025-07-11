import { PanelHandler } from 'util/module-helpers';

/**
 * Fullscreen gallery component.
 * Currently dependent on Map Selector functionality to work, could be generalized in future if needed.
 */
@PanelHandler({ exposeToPanel: true })
export class GalleryHandler {
	readonly panels = {
		mainImage: $<Image>('#MainImage'),
		thumbnails: $('#Thumbnails')
	};

	init(mapSelector: MomentumMapSelector, imageIDs: string[], baseUrl: string) {
		if (imageIDs.length === 0) {
			$.Warning('GalleryHandler: No images provided, cannot initialize gallery.');
			return;
		}

		const thumbs = imageIDs.map((id, i) => {
			const thumbnail = $.CreatePanel('Image', this.panels.thumbnails, '', {
				src: `file://{images}/gallery/${id}.jpg`,
				class: 'gallery__thumbnail'
			});

			if (i === 0) {
				thumbnail.AddClass('gallery__thumbnail--first');
			}

			mapSelector.applyMapImageToImagePanel(thumbnail, id, true, baseUrl);

			thumbnail.SetPanelEvent('onactivate', () =>
				mapSelector.applyMapImageToImagePanel(this.panels.mainImage, id, false, baseUrl)
			);

			return thumbnail;
		});

		$.DispatchEvent('Activated', thumbs[0], PanelEventSource.MOUSE);
	}
}
