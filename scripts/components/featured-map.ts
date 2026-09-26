import { PanelHandler } from 'util/module-helpers';
import { scaleWidthToAspectRatio } from 'util/functions';

@PanelHandler()
class FeaturedMapHandler {
	readonly panels = {
		mapImage: $<Image>('#MapImage')
	};
	constructor() {
		const scaledWidth = scaleWidthToAspectRatio(200);
		this.panels.mapImage.style.width = `${scaledWidth}px`;
		this.panels.mapImage.style.height = `${scaledWidth * 0.5625}px`;
	}
}
