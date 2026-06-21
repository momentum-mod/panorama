import { PanelHandler } from 'util/module-helpers';
import { parseMapImageUrl } from 'util/functions';
/**
 * Fullscreen gallery component.
 * Currently dependent on Map Selector functionality to work, could be generalized in future if needed.
 */
@PanelHandler({ exposeToPanel: true })
export class GalleryHandler {
	readonly panels = {
		top: $<Panel>('#Top'),
		mainImage: $<Image>('#MainImage'),
		thumbnails: $('#Thumbnails')
	};

	init(mapSelector: MomentumMapSelector, staticData: MapCacheAPI.StaticData) {
		const imageIDs = staticData.images?.map(({ id }) => id) ?? [];

		if (imageIDs.length === 0) {
			$.Warning('GalleryHandler: No images provided, cannot initialize gallery.');
			return;
		}

		$.Msg("WE'RE IN GALLERY");
		this.panels.top.SetDialogVariable('name', staticData.name);

		const baseUrl = parseMapImageUrl(staticData) ?? '';

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
