const SettingsTabs = {
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
			OnlineGhostSubSection: 'OnlineGhostRadio',
			GhostSubSection: 'GhostRadio',
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
			JumpStatsSubSection: 'JumpStatsRadio',
			WeaponSelSubSection: 'WeaponSelRadio',
			StrafeSyncSubSection: 'StrafeSyncRadio',
			SynchronizerSubSection: 'SynchronizerRadio',
			MapInfoSubSection: 'MapInfoRadio',
			DamageIndicatorSubSection: 'DamageIndicatorRadio'
		}
	},
	SearchSettings: {
		xml: 'search'
	}
};
