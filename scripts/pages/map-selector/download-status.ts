class MapDownloadStatus {
	static cancelDownload() {
		$.DispatchEvent('MapSelector_ConfirmCancelDownload', $.GetContextPanel().GetAttributeInt('mapID', 0));
	}
}
