class Split {
	static onLoad() {
		this.update();
	}

	static update() {
		const cp = $.GetContextPanel();

		const name = cp.name;
		const time = cp.time;
		const isFirst = cp.isFirst;
		const diff = cp.diff;
		const delta = cp.delta;

		cp.SetDialogVariable('name', name);
		cp.SetDialogVariableFloat('time', time);

		if (!isFirst) {
			cp.SetDialogVariable('diff_sign', diff > 0 ? '+' : diff === 0 ? '' : '-');
			cp.SetDialogVariableFloat('diff', Math.abs(diff));
		}

		cp.SetHasClass('split--first', isFirst);
		cp.SetHasClass('split--ahead', diff < 0);
		cp.SetHasClass('split--behind', diff > 0);
		cp.SetHasClass('split--gain', delta <= 0);
		cp.SetHasClass('split--loss', delta > 0);
	}
}
