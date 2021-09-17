'use strict';


class ControlsLibrary {

	static updatingProgressBars;
	static Init() {
		$.Msg($('#ControlsLibraryPanel'));
		ControlsLibrary.updatingProgressBars = true;
		if (ControlsLibrary.updatingProgressBars)
			ControlsLibrary.updateProgressBars();
	}

	static updateProgressBars() {
		const progressBar1 = $('#ProgressBar1');

		if (progressBar1.value <= progressBar1.max)
			progressBar1.value += 0.01;
		else progressBar1.value = progressBar1.min;

		if (ControlsLibrary.updatingProgressBars) {
			$.Schedule(0.1, ControlsLibrary.updateProgressBars);
		}
	}

	static OnSimpleContextMenu() {
		var items = [];
		items.push({ label: 'Item 1', jsCallback: function() { $.Msg('Item 1 pressed'); } });
		items.push({ label: 'Item 2', jsCallback: function() { $.Msg('Item 2 pressed'); } });
		items.push({ label: 'Item 3 w/ top separator', style:'TopSeparator', jsCallback: function() { $.Msg('Item 3 pressed'); } });
		UiToolkitAPI.ShowSimpleContextMenu('', 'ControlsLibSimpleContextMenu', items);
	}
}

(function () {
	ControlsLibrary.Init();
})();