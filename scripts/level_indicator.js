"use strict";

class LevelIndicator {
	static onLoad() {
		const level = $.GetContextPanel().GetAttributeInt("level", 0);
		$('#PlayerLevel').style.backgroundColor = LevelIndicator.getColorForLevel(level);
		$.GetContextPanel().SetDialogVariableInt("level", level);
		
		const prestige = $.GetContextPanel().GetAttributeInt("prestige", 0);
		$('#PrestigeIcon').SetImage(LevelIndicator.getImageForPrestige(level, prestige));
		if (prestige == 0) {
			// No icon for prestige 0
			$('#PrestigeIcon').AddClass('hidden');
		}
		
		const textColor = LevelIndicator.getTextColorForLevel(level);
		$('#PrestigeIcon').style.washColor = textColor;
		$('#LevelText').style.color = textColor;
		
		if (level == 500 && prestige == 5) {
			// Once user reaches level 500 of 5th prestige, only show icon
			$('#LevelText').AddClass('hidden');
		}
	}
	
	static getColorForLevel(level) {
		if (level < 50) {
			return '#5d5d5d';
		}
		else if (level < 100) {
			return '#e84855';
		}
		else if (level < 150) {
			return '#ff8645';
		}
		else if (level < 200) {
			return '#f9dc5c';
		}
		else if (level < 250) {
			return '#47c27c';
		}
		else if (level < 300) {
			return '#3f4aca';
		}
		else if (level < 350) {
			return '#873de1';
		}
		else if (level < 400) {
			return '#d34a8d';
		}
		else if (level < 450) {
			return '#3185fc';
		}
		else { // 450+
			return '#000000';
		}
	}
	
	static getImageForPrestige(level, prestige) {
		if (prestige <= 0)
			return '';

		if (prestige > 5) {
			prestige = 5;
		}

		let imageName = 'prestige' + prestige + '.svg';
		if (prestige == 5 && level == 500) {
			imageName = 'max_level.svg';
		}

		return 'file://{images}/prestige/' + imageName;
	}
	
	static getTextColorForLevel(level) {
		if (level >= 150 && level < 200) {
			return '#000000';
		}
		return '#ffffff';
	}
}