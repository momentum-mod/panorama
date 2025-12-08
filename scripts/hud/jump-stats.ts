import { PanelHandler } from 'util/module-helpers';
import { RegisterHUDPanelForGamemode } from '../util/register-for-gamemodes';
import { GamemodeCategory } from 'common/web/enums/gamemode.enum';
import { GamemodeCategories } from 'common/web/maps/gamemodes.map';
import { Button } from 'common/buttons';

enum StrafeDirection {
	None,
	Left,
	Right
}

@PanelHandler()
class JumpStatsHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudJumpStats>(),
		label: $<Label>('#JumpStatsLabel'),
		container: $<MomHudJumpStats>('#JumpStatsContainer')
	};

	jumpStatsConfig: typeof this.panels.cp.jumpStatsCFG;

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

	//Temporary fix, MomentumMovementAPI.GetLastJumpStats().jumpCount and .strafeCount is always returning 0
	jumpCounter = 0;
	strafeCounter = 0;
	prevStrafeDirection: StrafeDirection = StrafeDirection.None;
	prevBothPressed = false;

	constructor() {
		RegisterHUDPanelForGamemode({
			gamemodes: GamemodeCategories.get(GamemodeCategory.BHOP),
			onLoad: () => this.onMapInit(),
			//HudProcessInput, OnObservedTimerStateChange, MomentumSpectateStart, ObserverTargetChanged will need to be
			//removed/rewriten when MomentumMovementAPI.GetLastJumpStats().jumpCount and .strafeCount is fixed
			handledEvents: [
				{ event: 'OnJumpStarted', panel: this.panels.container, callback: () => this.onJump() },
				{ event: 'HudProcessInput', panel: $.GetContextPanel(), callback: () => this.onUpdate() }
			],
			events: [
				{ event: 'OnJumpStatsCFGChange', callback: () => this.onConfigChange() },
				{ event: 'OnObservedTimerStateChange', callback: () => this.onRunStart() },
				{ event: 'MomentumSpectateStart', callback: () => this.resetStats() },
				{ event: 'ObserverTargetChanged', callback: () => this.resetStats() }
			]
		});
	}
	//Temporary fix due to MomentumMovementAPI.GetLastJumpStats().jumpCount always returning 0, remove it from events too after it's fixed
	onRunStart() {
		const timerState = MomentumTimerAPI.GetObservedTimerStatus().state;
		if (timerState !== 2) this.resetStats();
	}

	resetStats() {
		this.jumpCounter = 0;
		this.strafeCounter = 0;
		this.prevStrafeDirection = StrafeDirection.None;
		this.prevBothPressed = false;
	}

	//Temporary fix due to MomentumMovementAPI.GetLastJumpStats().strafeCount always returning 0, remove it from events too after it's fixed
	onUpdate() {
		const pressed = MomentumInputAPI.GetButtons().physicalButtons;
		const left = !!(pressed & Button.MOVELEFT);
		const right = !!(pressed & Button.MOVERIGHT);
		const both = left && right;

		const flip = (dir: StrafeDirection) =>
			dir === StrafeDirection.Left ? StrafeDirection.Right : StrafeDirection.Left;

		// --- FIRST JUMP ---
		if (this.prevStrafeDirection === StrafeDirection.None) {
			if (!left && !right) {
				this.prevBothPressed = false;
				return;
			}

			this.prevStrafeDirection = left ? StrafeDirection.Left : StrafeDirection.Right;

			this.strafeCounter++;
			this.prevBothPressed = both;
			return;
		}

		// --- BOTH PRESSED ---
		if (both) {
			if (!this.prevBothPressed) {
				this.prevStrafeDirection = flip(this.prevStrafeDirection);
				this.strafeCounter++;
			}
			this.prevBothPressed = true;
			return;
		}

		// --- SINGLE KEY ---
		if (this.prevStrafeDirection === StrafeDirection.Left && right) {
			this.prevStrafeDirection = StrafeDirection.Right;
			this.strafeCounter++;
			this.prevBothPressed = false;
			return;
		}

		if (this.prevStrafeDirection === StrafeDirection.Right && left) {
			this.prevStrafeDirection = StrafeDirection.Left;
			this.strafeCounter++;
			this.prevBothPressed = false;
			return;
		}

		this.prevBothPressed = both;
	}

	onJump() {
		//MomentumMovementAPI.GetLastJumpStats().jumpCount is always returning 0, jumpCounter is a temporary fix
		const lastJumpStats = MomentumMovementAPI.GetLastJumpStats();
		this.jumpCounter++;

		if (this.jumpCounter < this.jumpStatsConfig.statsFirstPrint) return;

		if (this.jumpStatsConfig.statsInterval === 0) {
			if (this.jumpCounter !== this.jumpStatsConfig.statsFirstPrint) return;
		} else if ((this.jumpCounter - this.jumpStatsConfig.statsFirstPrint) % this.jumpStatsConfig.statsInterval !== 0)
			return;

		if (this.jumpCounter === 1) {
			// Most stats are noise on the first jump when tracking jumps like css
			// Only show takeoff speed
			this.addToBuffer(this.countBuffer, this.jumpCounter + ':');
			this.addToBuffer(this.takeoffSpeedBuffer, lastJumpStats.takeoffSpeed.toFixed(0));
			this.addToBuffer(this.speedDeltaBuffer, '');
			this.addToBuffer(this.takeoffTimeBuffer, '');
			this.addToBuffer(this.timeDeltaBuffer, '');
			this.addToBuffer(this.strafesBuffer, '');
			this.addToBuffer(this.syncBuffer, '');
			this.addToBuffer(this.gainBuffer, '');
			this.addToBuffer(this.yawRatioBuffer, '');
			this.addToBuffer(this.heightDeltaBuffer, '');
			this.addToBuffer(this.distanceBuffer, '');
			this.addToBuffer(this.efficiencyBuffer, '');
		} else {
			this.addToBuffer(this.countBuffer, this.jumpCounter + ':');
			this.addToBuffer(this.takeoffSpeedBuffer, lastJumpStats.takeoffSpeed.toFixed(0));
			this.addToBuffer(this.speedDeltaBuffer, lastJumpStats.jumpSpeedDelta.toFixed(0));
			this.addToBuffer(this.takeoffTimeBuffer, this.makeTime(lastJumpStats.takeoffTime));
			this.addToBuffer(this.timeDeltaBuffer, lastJumpStats.timeDelta.toFixed(3));
			this.addToBuffer(this.strafesBuffer, this.strafeCounter.toFixed(0));
			this.addToBuffer(this.syncBuffer, this.makePercentage(lastJumpStats.strafeSync));
			this.addToBuffer(this.gainBuffer, this.makePercentage(lastJumpStats.speedGain));
			this.addToBuffer(this.yawRatioBuffer, this.makePercentage(lastJumpStats.yawRatio));
			this.addToBuffer(
				this.heightDeltaBuffer,
				(Math.abs(lastJumpStats.heightDelta) < 0.1 ? 0 : lastJumpStats.heightDelta).toFixed(1)
			);
			this.addToBuffer(this.distanceBuffer, lastJumpStats.distance.toFixed(1));
			this.addToBuffer(this.efficiencyBuffer, this.makePercentage(lastJumpStats.efficiency));
		}

		this.setText();

		//Temporary fix due to MomentumMovementAPI.GetLastJumpStats().strafeCount always returning 0
		this.strafeCounter = 0;
		this.prevStrafeDirection = StrafeDirection.None;
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
		this.jumpStatsConfig = this.panels.cp.jumpStatsCFG;
		if (this.jumpStatsConfig.statsLog !== this.bufferLength) {
			this.bufferLength = this.jumpStatsConfig.statsLog;
			this.initializeStats();
		}
	}

	onMapInit() {
		this.onConfigChange();
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
