import { exposeToPanelContext, OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { ToastLocation, ToastManager } from 'util/toast-manager';

// Expose toast stuff to XML
exposeToPanelContext({ ToastManager, ToastLocation });

@PanelHandler()
class ControlsLibraryHandler implements OnPanelLoad {
	progressBar1 = $<ProgressBar>('#ProgressBar1');
	updatingProgressBars = true;

	onPanelLoad() {
		this.updateProgressBars();
	}

	updateProgressBars() {
		if (this.progressBar1.value <= this.progressBar1.max) this.progressBar1.value += 0.01;
		else this.progressBar1.value = this.progressBar1.min;

		if (this.updatingProgressBars) {
			$.Schedule(0.1, () => this.updateProgressBars());
		}
	}

	onSimpleContextMenu() {
		UiToolkitAPI.ShowSimpleContextMenu('', '', [
			{
				label: 'Item 1',
				jsCallback: () => $.Msg('Item 1 pressed')
			},
			{
				label: 'Item 2',
				jsCallback: () => $.Msg('Item 2 pressed')
			},
			{
				label: 'Item 3 w/ top separator',
				style: 'TopSeparator',
				jsCallback: () => $.Msg('Item 3 pressed')
			}
		]);
	}
}
