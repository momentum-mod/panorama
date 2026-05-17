import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';

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
			name: 'Jump Stats (SSJ)',
			resizeX: false,
			resizeY: false,
			gamemode: GamemodeCategoryToGamemode.get(GamemodeCategory.BHOP),
			events: { event: 'OnJumpStarted', panel: this.panels.container, callbackFn: () => this.onJump() },
			dynamicStyles: {
				fontStyling: {
					name: 'Font Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'font' }, { styleID: 'fontSize' }, { styleID: 'fontColor' }]
				},
				font: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: ['.jumpstats__label', '.jumpstats__label--name', '.jumpstats__label--values'],
					styleProperty: 'fontFamily'
				},
				fontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: ['.jumpstats__label', '.jumpstats__label--name', '.jumpstats__label--values'],
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 7, max: 19 }
				},
				fontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: ['.jumpstats__label', '.jumpstats__label--name', '.jumpstats__label--values'],
					styleProperty: 'color',
					callbackFunc: (panel, value) => {
						panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9);
						const nameLabel = panel.GetChild(0);
						if (nameLabel) {
							nameLabel.style.borderTop = `1px solid ${value}`;
						}
					}
				},
				logSettings: {
					name: 'Log Settings',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'statsFirstPrint' }, { styleID: 'statsInterval' }, { styleID: 'statsLog' }]
				},
				statsFirstPrint: {
					name: 'First Print',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.jumpStatsConfig.statsFirstPrint = value;
					}
				},
				statsInterval: {
					name: 'Interval',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.jumpStatsConfig.statsInterval = value;
					}
				},
				statsLog: {
					name: 'Log Window',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						this.jumpStatsConfig.statsLog = value;
						this.onConfigChange();
					}
				},
				toggleStats: {
					name: 'Toggle Stats',
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
					name: 'Show Take Off Speed',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--speed',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showSpeedDelta: {
					name: 'Show Speed Delta',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--speed-delta',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showGain: {
					name: 'Show Gain',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--gain',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showYawRatio: {
					name: 'Show Yaw Ratio',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--yaw-ratio',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showStrafeSync: {
					name: 'Show Strafe Sync',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--sync',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showEfficiency: {
					name: 'Show Efficiency',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--efficiency',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showStrafeCount: {
					name: 'Show Strafe Count',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--strafes',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showTakeoffTime: {
					name: 'Show Take Off Time',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--time',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showTimeDelta: {
					name: 'Show Time Delta',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--time-delta',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showDistance: {
					name: 'Show Distance',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--distance',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				showHeightDelta: {
					name: 'Show Height Delta',
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '.jumpstats__label--height-delta',
					callbackFunc: (panel, value) => {
						panel.SetHasClass('hide', !value);
					}
				},
				backgroundColor: {
					name: 'Background Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.jumpstats__container',
					styleProperty: 'backgroundColor'
				}
				// I have no idea what this is
				// enviroAccelEnable: {
				// 	name: 'Show Enviroment Acceleration?????',
				// 	type: CustomizerPropertyType.CHECKBOX,
				//     targetPanel: ''
				// 	callbackFunc: (panel, value) => {
				// 		panel.SetHasClass('hide', !value);
				// 		// this.jumpStatsConfig.enviroAccelEnable = value;
				// 	}
				// },
			}
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
