import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class MapDownloadStatusHandler {
	cancelDownload() {
		$.DispatchEvent('MapSelector_ConfirmCancelDownload', $.GetContextPanel().GetAttributeInt('mapID', 0));
	}
}
