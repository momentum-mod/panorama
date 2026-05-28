import { PanelHandler } from 'util/module-helpers';
import { Gamemode } from 'common/web/enums/gamemode.enum';

import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { getTextShadowFast } from 'common/hud-customizer';

type JumpStatsType = {
	statsFirstPrint: int32;
	statsInterval: int32;
	statsLog: int32;
};

@PanelHandler()
class JumpStatsHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudJumpStats>(),
		label: $<Label>('#JumpStatsLabel'),
		container: $<MomHudJumpStats>('#JumpStatsContainer')
	};

	jumpStatsConfig = {} as JumpStatsType;

	bufferLength: number;
	countBuffer: string[];
	takeoffSpeedBuffer: string[];
	speedDeltaBuffer: string[];
	takeoffTimeBuffer: string[];
	timeDeltaBuffer: string[];
	strafesBuffer: string[];
	syncBuffer: string[];
	gainBuffer: string[];
	yawRatioBuffer: string[];
	heightDeltaBuffer: string[];
	distanceBuffer: string[];
	efficiencyBuffer: string[];

	constructor() {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Jump_Stats_Name'),
			resizeX: false,
			resizeY: false,
			gamemode: Gamemode.BHOP,
			events: { event: 'OnJumpStarted', panel: this.panels.container, callbackFn: () => this.onJump() },
			dynamicStyles: {
				fontStyling: {
					name: $.Localize('#Customizer_FontStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'font' }, { styleID: 'fontSize' }, { styleID: 'fontColor' }]
				},
				font: {
					name: $.Localize('#Customizer_Font'),
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: ['.jumpstats__label', '.jumpstats__label--name', '.jumpstats__label--values'],
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: ['.jumpstats__label', '.jumpstats__label--name', '.jumpstats__label--values'],
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 7, max: 19 }
				},
				fontColor: {
					name: $.Localize('#Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: ['.jumpstats__label', '.jumpstats__label--name', '.jumpstats__label--values'],
					styleProperty: 'color',
					callbackFunc: (panel, value) => {
						panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9);
						const nameLabel = panel.GetChild(0);
						if (nameLabel) nameLabel.style.borderTop = `1px solid ${value}`;
					}
				},
				logSettings: {
					name: $.Localize('#Customizer_Jump_Stats_LogSettings'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'statsFirstPrint' }, { styleID: 'statsInterval' }, { styleID: 'statsLog' }]
				},
				statsFirstPrint: {
					name: $.Localize('#Customizer_Jump_Stats_StatsFirstPrint'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (this.jumpStatsConfig.statsFirstPrint = value)
				},
				statsInterval: {
					name: $.Localize('#Customizer_Jump_Stats_StatsInterval'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (this.jumpStatsConfig.statsInterval = value)
				},
				statsLog: {
					name: $.Localize('#Customizer_Jump_Stats_StatsLog'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => (this.jumpStatsConfig.statsLog = value),
					onChanged: () => this.onConfigChange()
				},
				toggleStats: {
					name: $.Localize('#Customizer_Jump_Stats_ToggleStats'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'showTakeoffSpeed' },
						{ styleID: 'showSpeedDelta' },
						{ styleID: 'showGain' },
						{ styleID: 'showYawRatio' },
						{ styleID: 'showStrafeSync' },
						{ styleID: 'showEfficiency' },
						{ styleID: 'showStrafeCount' },
						{ styleID: 'showTakeoffTime' },
						{ styleID: 'showTimeDelta' },
						{ styleID: 'showDistance' },
						{ styleID: 'showHeightDelta' }
					]
				},
				showTakeoffSpeed: {
					name: $.Localize('#Customizer_Jump_Stats_ShowTakeoffSpeed'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--speed',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showSpeedDelta: {
					name: $.Localize('#Customizer_Jump_Stats_ShowSpeedDelta'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--speed-delta',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showGain: {
					name: $.Localize('#Customizer_Jump_Stats_ShowGain'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--gain',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showYawRatio: {
					name: $.Localize('#Customizer_Jump_Stats_ShowYawRatio'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--yaw-ratio',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showStrafeSync: {
					name: $.Localize('#Customizer_Jump_Stats_ShowStrafeSync'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--sync',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showEfficiency: {
					name: $.Localize('#Customizer_Jump_Stats_ShowEfficiency'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--efficiency',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showStrafeCount: {
					name: $.Localize('#Customizer_Jump_Stats_ShowStrafeCount'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--strafes',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showTakeoffTime: {
					name: $.Localize('#Customizer_Jump_Stats_ShowTakeoffTime'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--time',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showTimeDelta: {
					name: $.Localize('#Customizer_Jump_Stats_ShowTimeDelta'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--time-delta',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showDistance: {
					name: $.Localize('#Customizer_Jump_Stats_ShowDistance'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--distance',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showHeightDelta: {
					name: $.Localize('#Customizer_Jump_Stats_ShowHeightDelta'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--height-delta',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				backgroundColor: {
					name: $.Localize('#Customizer_BackgroundColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.jumpstats__container',
					styleProperty: 'backgroundColor'
				}
				// I have no idea what this is
				// enviroAccelEnable: {
				// 	name: $.Localize('#Customizer_Jump_Stats_EnviroAccelEnable'),
				// 	type: CustomizerPropertyType.CHECKBOX,
				//     targetPanel: ''
				// 	callbackFunc: (panel, value) => {
				// 		panel.SetHasClass('hide', !value);
				// 		// this.jumpStatsConfig.enviroAccelEnable = value;
				// 	}
				// },
			},
			postInit: () => this.onConfigChange()
		});
	}

	onJump() {
		const lastJumpStats = MomentumMovementAPI.GetLastJumpStats();
		if (lastJumpStats.jumpCount < this.jumpStatsConfig.statsFirstPrint) {
			return;
		}

		if (this.jumpStatsConfig.statsInterval === 0) {
			if (lastJumpStats.jumpCount !== this.jumpStatsConfig.statsFirstPrint) return;
		} else if (
			(lastJumpStats.jumpCount - this.jumpStatsConfig.statsFirstPrint) % this.jumpStatsConfig.statsInterval !==
			0
		) {
			return;
		}

		this.addToBuffer(this.countBuffer, lastJumpStats.jumpCount + ':');
		this.addToBuffer(this.takeoffSpeedBuffer, lastJumpStats.takeoffSpeed.toFixed(0));
		this.addToBuffer(this.speedDeltaBuffer, lastJumpStats.jumpSpeedDelta.toFixed(0));
		this.addToBuffer(this.takeoffTimeBuffer, this.makeTime(lastJumpStats.takeoffTime));
		this.addToBuffer(this.timeDeltaBuffer, lastJumpStats.timeDelta.toFixed(3));
		this.addToBuffer(this.strafesBuffer, lastJumpStats.strafeCount.toFixed(0));
		this.addToBuffer(this.syncBuffer, this.makePercentage(lastJumpStats.strafeSync));
		this.addToBuffer(this.gainBuffer, this.makePercentage(lastJumpStats.speedGain));
		this.addToBuffer(this.yawRatioBuffer, this.makePercentage(lastJumpStats.yawRatio));
		this.addToBuffer(
			this.heightDeltaBuffer,
			(Math.abs(lastJumpStats.heightDelta) < 0.1 ? 0 : lastJumpStats.heightDelta).toFixed(1)
		);
		this.addToBuffer(this.distanceBuffer, lastJumpStats.distance.toFixed(1));
		this.addToBuffer(this.efficiencyBuffer, this.makePercentage(lastJumpStats.efficiency));

		this.setText();
	}

	initializeBuffer(size: number): string[] {
		const buffer = Array.from({ length: size }).fill('\n') as string[];
		buffer[buffer.length - 1] = '';
		return buffer;
	}

	addToBuffer(buffer: string[], value: string) {
		buffer[buffer.length - 1] += '\n';
		buffer.push(value);

		if (buffer.length > this.bufferLength) buffer.shift();
	}

	getBufferedSum(history: string[]): string {
		return history.reduce((sum, element) => sum + element);
	}

	onConfigChange() {
		if (this.jumpStatsConfig.statsLog !== this.bufferLength) {
			this.bufferLength = this.jumpStatsConfig.statsLog;
			this.initializeStats();
		}
	}

	onMapInit() {
		this.initializeStats();
		this.setText();
	}

	initializeStats() {
		this.countBuffer = this.initializeBuffer(this.bufferLength);
		this.takeoffSpeedBuffer = this.initializeBuffer(this.bufferLength);
		this.speedDeltaBuffer = this.initializeBuffer(this.bufferLength);
		this.takeoffTimeBuffer = this.initializeBuffer(this.bufferLength);
		this.timeDeltaBuffer = this.initializeBuffer(this.bufferLength);
		this.strafesBuffer = this.initializeBuffer(this.bufferLength);
		this.syncBuffer = this.initializeBuffer(this.bufferLength);
		this.gainBuffer = this.initializeBuffer(this.bufferLength);
		this.yawRatioBuffer = this.initializeBuffer(this.bufferLength);
		this.heightDeltaBuffer = this.initializeBuffer(this.bufferLength);
		this.distanceBuffer = this.initializeBuffer(this.bufferLength);
		this.efficiencyBuffer = this.initializeBuffer(this.bufferLength);
	}

	setText(): void {
		this.panels.cp.SetDialogVariable('jump_count', this.getBufferedSum(this.countBuffer));
		this.panels.cp.SetDialogVariable('speed', this.getBufferedSum(this.takeoffSpeedBuffer));
		this.panels.cp.SetDialogVariable('speed_delta', this.getBufferedSum(this.speedDeltaBuffer));
		this.panels.cp.SetDialogVariable('time', this.getBufferedSum(this.takeoffTimeBuffer));
		this.panels.cp.SetDialogVariable('time_delta', this.getBufferedSum(this.timeDeltaBuffer));
		this.panels.cp.SetDialogVariable('strafes', this.getBufferedSum(this.strafesBuffer));
		this.panels.cp.SetDialogVariable('sync', this.getBufferedSum(this.syncBuffer));
		this.panels.cp.SetDialogVariable('gain', this.getBufferedSum(this.gainBuffer));
		this.panels.cp.SetDialogVariable('yaw_ratio', this.getBufferedSum(this.yawRatioBuffer));
		this.panels.cp.SetDialogVariable('height_delta', this.getBufferedSum(this.heightDeltaBuffer));
		this.panels.cp.SetDialogVariable('distance', this.getBufferedSum(this.distanceBuffer));
		this.panels.cp.SetDialogVariable('efficiency', this.getBufferedSum(this.efficiencyBuffer));
	}

	makeTime(value: number): string {
		const hours = (value / 3600).toFixed(0).padStart(2, '0');
		const minutes = (Math.floor(value / 60) % 60).toFixed(0).padStart(2, '0');
		const seconds = (value % 60).toFixed(3).padStart(6, '0');
		return `${hours}:${minutes}:${seconds}`;
	}

	makePercentage(ratio: number): string {
		return (ratio * 100).toFixed(1) + '%';
	}
}
