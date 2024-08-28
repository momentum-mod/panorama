import { OnPanelLoad, PanelHandler } from 'util/module-helpers';

@PanelHandler({ exposeToPanel: true })
export class LevelIndicatorHandler implements OnPanelLoad {
	totalLevel: number;

	readonly panels = {
		cp: $.GetContextPanel<LevelIndicator>(),
		icon: $<Image>('#PrestigeIcon'),
		iconIncrement: $<Image>('#PrestigeIconIncrement')
	};

	onPanelLoad(): void {
		const level = $.GetContextPanel().GetAttributeInt('level', 0);

		if (level > 0) {
			this.setLevel(level);
		} else {
			this.panels.cp.SetDialogVariableInt('level', 0);
		}
	}

	setLevel(level: number): void {
		const innerLevel = this.getInnerLevel(level);
		const prestige = this.getPrestige(level);

		for (let i = 1; i <= 11; i++) {
			this.panels.cp.SetHasClass('levelindicator--' + i, i === this.getLevelColor(level));
		}

		this.panels.cp.SetDialogVariableInt('level', innerLevel);

		this.panels.icon.SetImage(this.getImageForPrestige(prestige));

		// No icon for prestige 0
		this.panels.icon.SetHasClass('levelindicator__icon--hidden', prestige === 0);
		this.panels.iconIncrement.SetHasClass('levelindicator__icon--hidden', prestige === 0);

		// Max level gets special styling
		this.panels.cp.SetHasClass('levelindicator--max', level > 3000);

		this.totalLevel = level;
	}

	incrementLevel(animDuration: number): void {
		// TODO: anims still fucky ESPECIALLY icons
		if (!this.totalLevel) return;

		const newLevel = this.totalLevel + 1;

		const cp = this.panels.cp;
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

	getLevelColor(level: number): number {
		if (level > 500) level = this.getInnerLevel(level); // Bound to 500
		if (level % 500 === 0) return 11; // The special 500th level class
		return Math.min(Math.max(Math.ceil((level + 1) / 50), 1), 10);
	}

	getPrestige(totalLevel: number): number {
		return Math.floor(Math.max(totalLevel - 1, 0) / 500);
	}

	getInnerLevel(totalLevel: number): number {
		return ((totalLevel - 1) % 500) + 1;
	}

	getImageForPrestige(prestige: number): string {
		if (prestige <= 0) return '';

		const imageName = prestige <= 5 ? 'prestige' + prestige + '.svg' : 'max_level.svg';

		return 'file://{images}/prestige/' + imageName;
	}
}
