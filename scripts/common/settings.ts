export const SettingsTabs = {
	InputSettings: {
		xml: 'input',
		radioid: 'InputRadio',
		children: {
			MouseSubSection: 'MouseRadio',
			KeybindSubSection: 'KeybindRadio'
		}
	},
	AudioSettings: {
		xml: 'audio',
		radioid: 'AudioRadio',
		children: {
			VolumeSubSection: 'VolumeRadio',
			AudioDeviceSubSection: 'AudioDeviceRadio'
		}
	},
	VideoSettings: {
		xml: 'video',
		radioid: 'VideoRadio',
		children: {
			VideoSubSection: 'VideoSubRadio',
			AdvancedVideoSubSection: 'AdvancedVideoRadio',
			TextureReplaceSubSection: 'TextureReplaceRadio'
		}
	},
	OnlineSettings: {
		xml: 'online',
		radioid: 'OnlineRadio',
		children: {
			ReplaySubSection: 'ReplayRadio',
			GhostSubSection: 'GhostRadio',
			OnlineGhostSubSection: 'OnlineGhostRadio',
			RichPresenceSubSection: 'RichPresenceRadio'
		}
	},
	GameplaySettings: {
		xml: 'gameplay',
		radioid: 'GameplayRadio',
		children: {
			GameplayGeneralSubSection: 'GameplayGeneralRadio',
			PaintSubSection: 'PaintRadio',
			SafeguardsSubSection: 'SafeguardsRadio',
			ZonesSubSection: 'ZonesRadio',
			AhopSubSection: 'AhopRadio',
			RocketJumpSubSection: 'RocketJumpRadio',
			StickyJumpSubSection: 'StickyJumpRadio',
			ConcSubSection: 'ConcRadio',
			DefragSubSection: 'DefragRadio'
		}
	},
	InterfaceSettings: {
		xml: 'interface',
		radioid: 'InterfaceRadio',
		children: {
			UISubSection: 'UIRadio',
			SpeedometerSubSection: 'SpeedometerRadio',
			CrosshairSubSection: 'CrosshairRadio',
			TimerSubSection: 'TimerRadio',
			PlayerStatusSubSection: 'PlayerStatusRadio',
			KeypressSubSection: 'KeypressRadio',
			ComparisonsSubSection: 'ComparisonsRadio',
			JumpStatsSubSection: 'JumpStatsRadio',
			WeaponSelSubSection: 'WeaponSelRadio',
			StrafeSyncSubSection: 'StrafeSyncRadio',
			StrafeTrainerSubSection: 'StrafeTrainerRadio',
			MapInfoSubSection: 'MapInfoRadio',
			DamageIndicatorSubSection: 'DamageIndicatorRadio'
		}
	},
	SearchSettings: {
		xml: 'search'
	}
};

export type SettingsTab = keyof typeof SettingsTabs;
export type SettingsTabWithoutSearch = Exclude<SettingsTab, 'SearchSettings'>;

export function isSettingsPanel(panel: GenericPanel): panel is SettingsPanel {
	return [
		'SettingsEnum',
		'SettingsSlider',
		'SettingsEnumBitField',
		'SettingsEnumDropDown',
		'SettingsKeyBinder',
		'SettingsToggle',
		'ConVarColorDisplay'
	].includes(panel.paneltype);
}
