'use strict';

const SettingsTabs = {
	InputSettings: {
		xml: 'settings_input',
		radioid: 'InputRadio',
		children: {
			MouseSubSection: 'MouseRadio',
			KeybindSubSection: 'KeybindRadio'
		}
	},
	AudioSettings: {
		xml: 'settings_audio',
		radioid: 'AudioRadio',
		children: {
			VolumeSubSection: 'VolumeRadio',
			AudioDeviceSubSection: 'AudioDeviceRadio'
		}
	},
	VideoSettings: {
		xml: 'settings_video',
		radioid: 'VideoRadio',
		children: {
			VideoSubSection: 'VideoSubRadio',
			AdvancedVideoSubSection: 'AdvancedVideoRadio',
			TextureReplaceSubSection: 'TextureReplaceRadio'
		}
	},
	OnlineSettings: {
		xml: 'settings_online',
		radioid: 'OnlineRadio',
		children: {
			OnlineGhostSubSection: 'OnlineGhostRadio',
			GhostSubSection: 'GhostRadio',
			RichPresenceSubSection: 'RichPresenceRadio'
		}
	},
	GameplaySettings: {
		xml: 'settings_gameplay',
		radioid: 'GameplayRadio',
		children: {
			GameplayGeneralSubSection: 'GameplayGeneralRadio',
			PaintSubSection: 'PaintRadio',
			SafeguardsSubSection: 'SafeguardsRadio',
			ZonesSubSection: 'ZonesRadio',
			RocketJumpSubSection: 'RocketJumpRadio',
			StickyJumpSubSection: 'StickyJumpRadio',
			ConcSubSection: 'ConcRadio',
			DefragSubSection: 'DefragRadio'
		}
	},
	InterfaceSettings: {
		xml: 'settings_interface',
		radioid: 'InterfaceRadio',
		children: {
			UISubSection: 'UIRadio',
			SpeedometerSubSection: 'SpeedometerRadio',
			CrosshairSubSection: 'CrosshairRadio',
			TimerSubSection: 'TimerRadio',
			PlayerStatusSubSection: 'PlayerStatusRadio',
			KeypressSubSection: 'KeypressRadio',
			WeaponSelSubSection: 'WeaponSelRadio',
			StrafeSyncSubSection: 'StrafeSyncRadio',
			SynchronizerSubSection: 'SynchronizerRadio',
			MapInfoSubSection: 'MapInfoRadio'
		}
	},
	SearchSettings: {
		xml: 'settings_search'
	}
};
