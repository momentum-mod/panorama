class LevelIndicator {
	static totalLevel;
	static panels = {
		icon: $('#PrestigeIcon'),
		iconIncrement: $('#PrestigeIconIncrement')
	};

	static {
		$.GetContextPanel().jsClass = this;
	}

	static onLoad() {
		// Load the level from the context panel
		const level = $.GetContextPanel().GetAttributeInt('level', 0);

		if (level > 0) this.setLevel(level);
	}

	static setLevel(level) {
		const cp = $.GetContextPanel();

		const innerLevel = this.getInnerLevel(level);
		const prestige = this.getPrestige(level);

		for (let i = 1; i <= 11; i++) {
			cp.SetHasClass('levelindicator--' + i, i === this.getLevelColor(level));
		}

		cp.SetDialogVariableInt('level', innerLevel);

		this.panels.icon.SetImage(this.getImageForPrestige(prestige));

		// No icon for prestige 0
		this.panels.icon.SetHasClass('levelindicator__icon--hidden', prestige === 0);
		this.panels.iconIncrement.SetHasClass('levelindicator__icon--hidden', prestige === 0);

		// Max level gets special styling
		cp.SetHasClass('levelindicator--max', level > 3000);

		this.totalLevel = level;
	}

	static incrementLevel(animDuration) {
		// TODO: anims still fucky ESPECIALLY icons
		if (!this.totalLevel) return;

		const newLevel = this.totalLevel + 1;

		const cp = $.GetContextPanel();
		for (const panel of [cp, cp.FindChild('Container'), cp.FindChild('IncrementContainer')])
			panel.style.animationDuration = `${animDuration}s`;

		cp.SetDialogVariableInt('level_incr', this.getInnerLevel(newLevel));
		this.panels.iconIncrement.SetHasClass('levelindicator__icon--hidden', this.getPrestige(newLevel) === 0);
		this.panels.iconIncrement.SetImage(this.getImageForPrestige(this.getPrestige(newLevel)));

		cp.AddClass('levelindicator--incrementing');
		cp.SetHasClass(
			'levelindicator--bg-incrementing',
			this.getLevelColor(newLevel) !== this.getLevelColor(this.totalLevel)
		);

		$.Schedule(animDuration, () => {
			cp.RemoveClass('levelindicator--incrementing');
			cp.RemoveClass('levelindicator--bg-incrementing');
			this.setLevel(newLevel);
		});
	}

	static getLevelColor(level) {
		if (level > 500) level = this.getInnerLevel(level); // Bound to 500
		if (level % 500 === 0) return 11; // The special 500th level class
		return Math.min(Math.max(Math.ceil((level + 1) / 50), 1), 10);
	}

	static getPrestige(totalLevel) {
		return Math.floor(Math.max(totalLevel - 1, 0) / 500);
	}

	static getInnerLevel(totalLevel) {
		return ((totalLevel - 1) % 500) + 1;
	}

	static getImageForPrestige(prestige) {
		if (prestige <= 0) return '';

		const imageName = prestige <= 5 ? 'prestige' + prestige + '.svg' : 'max_level.svg';

		return 'file://{images}/prestige/' + imageName;
	}
}
