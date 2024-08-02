class ControlsLibrary {
	static progressBar1 = $<ProgressBar>('#ProgressBar1');
	static updatingProgressBars = true;

	static {
		this.updateProgressBars();
	}

	static updateProgressBars() {
		if (this.progressBar1.value <= this.progressBar1.max) this.progressBar1.value += 0.01;
		else this.progressBar1.value = this.progressBar1.min;

		if (this.updatingProgressBars) {
			$.Schedule(0.1, () => this.updateProgressBars());
		}
	}

	static onSimpleContextMenu() {
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
