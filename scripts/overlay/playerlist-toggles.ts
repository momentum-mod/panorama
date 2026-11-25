import { PanelHandler } from 'util/module-helpers';

interface ConVarToggle {
	id: string;
	convar: string;
	tooltipWhenOn: string;
	tooltipWhenOff: string;
}

const TOGGLES: ConVarToggle[] = [
	{
		id: 'VoiceToggle',
		convar: 'voice_enable',
		tooltipWhenOn: '#HudTabMenu_MuteAllPlayers',
		tooltipWhenOff: '#HudTabMenu_UnmuteAllPlayers'
	},
	{
		id: 'PaintToggle',
		convar: 'mom_paint_hide_others',
		tooltipWhenOn: '#HudTabMenu_ShowOthersPaint',
		tooltipWhenOff: '#HudTabMenu_HideOthersPaint'
	},
	{
		id: 'PlayersToggle',
		convar: 'mom_hide_players',
		tooltipWhenOn: '#HudTabMenu_ShowOtherPlayers',
		tooltipWhenOff: '#HudTabMenu_HideOtherPlayers'
	}
];

@PanelHandler()
class PlayerListTogglesHandler {
	constructor() {
		for (const toggle of TOGGLES) {
			const button = $(`#${toggle.id}`);
			button.SetPanelEvent('onmouseover', () => this.showTooltip(toggle));
			button.SetPanelEvent('onmouseout', () => UiToolkitAPI.HideTextTooltip());
			button.SetPanelEvent('onactivate', () => this.showTooltip(toggle));
		}
	}

	showTooltip(toggle: ConVarToggle) {
		const tooltip = GameInterfaceAPI.GetSettingBool(toggle.convar) ? toggle.tooltipWhenOn : toggle.tooltipWhenOff;
		UiToolkitAPI.ShowTextTooltip(toggle.id, $.Localize(tooltip));
	}
}
