class JumpStats {
	/** @type {Label} @static */
	static label = $('#JumpStatsLabel');
	/** @type {Panel} @static */
	static container = $('#JumpStatsContainer');
	/** @type {Panel} @static */
	static panel = $.GetContextPanel();

	static onJump() {
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

		if (lastJumpStats.jumpCount === 1) {
			// Most stats are noise on the first jump when tracking jumps like css
			// Only show takeoff speed
			this.addToBuffer(this.countBuffer, lastJumpStats.jumpCount + ':');
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
			this.addToBuffer(this.countBuffer, lastJumpStats.jumpCount + ':');
			this.addToBuffer(this.takeoffSpeedBuffer, lastJumpStats.takeoffSpeed.toFixed(0));
			this.addToBuffer(this.speedDeltaBuffer, lastJumpStats.jumpSpeedDelta.toFixed(0));
			this.addToBuffer(this.takeoffTimeBuffer, this.makeTime(lastJumpStats.takeoffTime));
			this.addToBuffer(this.timeDeltaBuffer, lastJumpStats.timeDelta.toFixed(3));
			this.addToBuffer(this.strafesBuffer, lastJumpStats.strafeCount);
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
	}

	static initializeBuffer(size) {
		const buffer = Array.from({ length: size }).fill('\n');
		buffer[buffer.length - 1] = '';
		return buffer;
	}

	static addToBuffer(buffer, value) {
		buffer[buffer.length - 1] += '\n';
		buffer.push(value);

		if (buffer.length > this.bufferLength) buffer.shift();
	}

	static getBufferedSum(history) {
		return history.reduce((sum, element) => sum + element);
	}

	static onConfigChange() {
		this.jumpStatsConfig = this.panel.jumpStatsCFG;
		if (this.jumpStatsConfig.statsLog !== this.bufferLength) {
			this.bufferLength = this.jumpStatsConfig.statsLog;
			this.initializeStats();
		}
	}

	static onLoad() {
		this.onConfigChange();
		this.initializeStats();
		this.setText();
	}

	static initializeStats() {
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

	static setText() {
		this.panel.SetDialogVariable('jump_count', this.getBufferedSum(this.countBuffer));
		this.panel.SetDialogVariable('speed', this.getBufferedSum(this.takeoffSpeedBuffer));
		this.panel.SetDialogVariable('speed_delta', this.getBufferedSum(this.speedDeltaBuffer));
		this.panel.SetDialogVariable('time', this.getBufferedSum(this.takeoffTimeBuffer));
		this.panel.SetDialogVariable('time_delta', this.getBufferedSum(this.timeDeltaBuffer));
		this.panel.SetDialogVariable('strafes', this.getBufferedSum(this.strafesBuffer));
		this.panel.SetDialogVariable('sync', this.getBufferedSum(this.syncBuffer));
		this.panel.SetDialogVariable('gain', this.getBufferedSum(this.gainBuffer));
		this.panel.SetDialogVariable('yaw_ratio', this.getBufferedSum(this.yawRatioBuffer));
		this.panel.SetDialogVariable('height_delta', this.getBufferedSum(this.heightDeltaBuffer));
		this.panel.SetDialogVariable('distance', this.getBufferedSum(this.distanceBuffer));
		this.panel.SetDialogVariable('efficiency', this.getBufferedSum(this.efficiencyBuffer));
	}

	static makeTime(value) {
		const hours = (value / 3600).toFixed(0).padStart(2, '0');
		const minutes = (Math.floor(value / 60) % 60).toFixed(0).padStart(2, '0');
		const seconds = (value % 60).toFixed(3).padStart(6, '0');
		return `${hours}:${minutes}:${seconds}`;
	}

	static makePercentage(ratio) {
		return (ratio * 100).toFixed(1) + '%';
	}

	static {
		$.RegisterEventHandler('OnJumpStarted', this.container, this.onJump.bind(this));

		$.RegisterForUnhandledEvent('ChaosLevelInitPostEntity', this.onLoad.bind(this));
		$.RegisterForUnhandledEvent('OnJumpStatsCFGChange', this.onConfigChange.bind(this));
	}
}
