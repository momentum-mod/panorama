'use strict';

const COLORS = {
	EXTRA: ['rgba(24, 150, 211, 1)', 'rgba(87, 200, 255, 1)'],
	PERFECT: ['rgba(87, 200, 255, 1)', 'rgba(113, 240, 255, 1)'],
	GOOD: ['rgba(21, 152, 86, 1)', 'rgba(122, 238, 122, 1)'],
	SLOW: ['rgba(248, 222, 74, 1)', 'rgba(255, 238, 0, 1)'],
	NEUTRAL: ['rgba(178, 178, 178, 1)', 'rgba(255, 255, 255, 1)'],
	LOSS: ['rgba(220, 116, 13, 1)', 'rgba(255, 188, 0, 1)'],
	STOP: ['rgba(211, 24, 24, 1)', 'rgba(255, 87, 87, 1)']
};

class Synchronizer {
	static panels = {
		segments: [$('#Segment0'), $('#Segment1'), $('#Segment2'), $('#Segment3'), $('#Segment4')],
		container: $('#Container'),
		needle: $('#Needle')
	};

	static lastSpeed = 0;
	static lastAngle = 0;
	static rad2deg = 180 / Math.PI;
	static deg2rad = 1 / this.rad2deg;
	static indicatorPercentage = 90; // this value shows ~90% gain or better when strafe indicator touches needle
	static bIsFirstPanelColored = true; // gets toggled in wrapValueToRange()
	static maxSegmentWidth = 25; // percentage of total element width
	static firstPanelWidth = this.maxSegmentWidth;
	static altColor = 'rgba(0, 0, 0, 0.0)';

	static onLoad() {
		this.initializeSettings();

		this.bIsDefragging = GameModeAPI.GetCurrentGameMode() === GameMode.DEFRAG;

		this.maxSpeed = 30; // bhop max air speed
		this.syncGain = 1; // scale how fast the bars move
		this.syncRatio = 0;

		if (this.bIsDefragging) {
			this.maxAccel = 16.8; // 70 * 30 * 0.008
		} else {
			this.maxAccel = 30; // 1000 * 30 * 0.01 caps to this value
		}
	}

	static onUpdate() {
		const lastMoveData = MomentumMovementAPI.GetLastMoveData();
		const viewAngle = MomentumPlayerAPI.GetAngles().y;
		let nextVelocity;

		if (this.bIsDefragging) {
			const fastAngle = this.findFastAngle(this.lastSpeed, this.maxSpeed, this.maxAccel);
			nextVelocity = {
				x: this.lastSpeed + this.maxAccel * Math.cos(fastAngle),
				y: this.maxAccel * Math.sin(fastAngle)
			};
		} else {
			nextVelocity = {
				x: this.lastSpeed,
				y: this.maxAccel
			};
		}

		const allButtons = MomentumInputAPI.GetButtons().buttons;
		const strafeRight =
			!(allButtons & Buttons.FORWARD || allButtons & Buttons.BACK) &&
			(allButtons & Buttons.MOVERIGHT ? 1 : 0) - (allButtons & Buttons.MOVELEFT ? 1 : 0);

		const idealDelta =
			lastMoveData.moveStatus === 0 ? Math.atan2(nextVelocity.y, nextVelocity.x) * this.rad2deg : 0;
		const angleDelta = this.wrapValueToRange(this.lastAngle - viewAngle, -180, 180);
		const syncDelta = strafeRight * idealDelta - angleDelta;
		this.addToBuffer(this.syncDeltaHistory, this.sampleWeight * syncDelta);
		const direction = strafeRight * angleDelta > idealDelta ? -strafeRight : strafeRight;

		const speed = this.getSize(MomentumPlayerAPI.GetVelocity());
		const idealSpeed = this.getSize(nextVelocity);
		this.gainRatioHistory.push((this.sampleWeight * (speed - this.lastSpeed)) / (idealSpeed - this.lastSpeed));
		this.gainRatioHistory.shift();
		const gainRatio = this.getBufferedSum(this.gainRatioHistory);
		this.lastAngle = viewAngle;
		this.lastSpeed = speed;

		const colorTuple = this.mom_hud_synchro_color_enable
			? this.getColorTuple(gainRatio, strafeRight * angleDelta > idealDelta)
			: COLORS.NEUTRAL;
		const color = `gradient(linear, 0% 0%, 0% 100%, from(${colorTuple[0]}), to(${colorTuple[1]}))`;
		let flow;

		switch (this.mom_hud_synchro_mode) {
			case 1: // "Half-width throttle"
				flow = strafeRight * (this.mom_hud_synchro_flip_enable === 1 ? -1 : 1);
				this.panels.container.style.flowChildren = flow < 0 ? 'left' : 'right';

				const deltaRatio = (strafeRight * angleDelta) / idealDelta;
				this.addToBuffer(this.strafeRatioHistory, this.sampleWeight * deltaRatio);
				const strafeRatio = (0.5 * this.getBufferedSum(this.strafeRatioHistory)).toFixed(3);

				this.panels.segments[0].style.backgroundColor = color;
				this.panels.segments[0].style.width = strafeRatio * 100 + '%';
				break;
			case 2: // "Full-width throttle"
				const absRatio = Math.abs(gainRatio).toFixed(3);
				flow = direction * (this.mom_hud_synchro_flip_enable === 1 ? -1 : 1);
				this.panels.container.style.flowChildren = flow < 0 ? 'left' : 'right';

				this.panels.segments[0].style.backgroundColor = color;
				this.panels.segments[0].style.width = absRatio * 100 + '%';
				break;
			case 3: // "Strafe indicator"
				const offset =
					this.sampleWeight *
					Math.min(
						Math.max(
							0.5 - ((0.5 * syncDelta) / idealDelta) * (this.mom_hud_synchro_flip_enable === 1 ? -1 : 1),
							0
						),
						1
					);
				this.addToBuffer(this.offsetHistory, offset);
				this.panels.segments[0].style.width =
					(this.getBufferedSum(this.offsetHistory) * this.indicatorPercentage).toFixed(3) + '%';
				this.panels.segments[1].style.backgroundColor = color;
				break;
			case 4: // "Synchronizer"
				this.firstPanelWidth +=
					this.syncGain *
					this.getBufferedSum(this.syncDeltaHistory) *
					(this.mom_hud_synchro_flip_enable === 1 ? -1 : 1);
				this.firstPanelWidth = this.wrapValueToRange(this.firstPanelWidth, 0, this.maxSegmentWidth, true);
				this.panels.segments[0].style.width =
					(isNaN(this.firstPanelWidth) ? this.maxSegmentWidth : this.firstPanelWidth.toFixed(3)) + '%';
				this.panels.segments.forEach((segment, i) => {
					let index = i + (this.bIsFirstPanelColored ? 1 : 0);
					segment.style.backgroundColor = index % 2 ? color : this.altColor;
				});
				break;
		}
	}

	static getColorTuple(ratio, bOverStrafing) {
		// cases where gain effectiveness is >90%
		if (ratio > 1.02) return COLORS.EXTRA;
		else if (ratio > 0.99) return COLORS.PERFECT;
		else if (ratio > 0.95) return COLORS.GOOD;
		else if (ratio <= -5.0) return COLORS.STOP;

		const lerpColorTuples = (c1, c2, alpha) => {
			return [
				this.lerpColorStrings(c1[0], c2[0], alpha.toFixed(3)),
				this.lerpColorStrings(c1[1], c2[1], alpha.toFixed(3))
			];
		};

		// cases where gain effectiveness is <90%
		if (!bOverStrafing) {
			if (ratio > 0.85) return lerpColorTuples(COLORS.SLOW, COLORS.GOOD, (ratio - 0.85) / 0.1);
			else if (ratio > 0.75) return COLORS.SLOW;
			else if (ratio > 0.5) return lerpColorTuples(COLORS.NEUTRAL, COLORS.SLOW, (ratio - 0.5) / 0.25);
			else if (ratio > 0.0) return COLORS.NEUTRAL;
			else if (ratio > -5.0) return lerpColorTuples(COLORS.NEUTRAL, COLORS.STOP, Math.abs(ratio) / 5.0);
		} else {
			if (ratio > 0.8) return lerpColorTuples(COLORS.SLOW, COLORS.GOOD, (ratio - 0.8) / 0.15);
			else if (ratio > 0.0) return lerpColorTuples(COLORS.LOSS, COLORS.SLOW, (ratio - 0.25) / 0.55);
			else if (ratio > -5.0) return lerpColorTuples(COLORS.LOSS, COLORS.STOP, Math.abs(ratio) / 5.0);
		}
	}

	static wrapValueToRange(value, min, max, bShouldTrackWrap) {
		const range = max - min;
		while (value > max) {
			value -= range;
			if (bShouldTrackWrap) {
				this.bIsFirstPanelColored = !this.bIsFirstPanelColored; // less than clean way to track color flips
			}
		}
		while (value < min) {
			value += range;
			if (bShouldTrackWrap) {
				this.bIsFirstPanelColored = !this.bIsFirstPanelColored;
			}
		}
		return value;
	}

	static findFastAngle(speed, maxSpeed, maxAccel) {
		const threshold = maxSpeed - maxAccel;
		return Math.acos(speed < threshold ? 1 : threshold / speed);
	}

	static getSize(vec) {
		return Math.sqrt(this.getSizeSquared(vec));
	}

	static getSizeSquared(vec) {
		return vec.x * vec.x + vec.y * vec.y;
	}

	static initializeBuffer(size) {
		return Array(size).fill(0);
	}

	static addToBuffer(buffer, value) {
		buffer.push(value);
		buffer.shift();
	}

	static getBufferedSum(history) {
		return history.reduce((sum, element) => sum + element, 0);
	}

	static getColorStringFromArray(color) {
		return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
	}

	static splitColorString(string) {
		return string
			.slice(5, -1)
			.split(',')
			.map((c, i) => (i === 3 ? +c * 255 : +c));
	}

	static lerpColorStrings(stringA, stringB, alpha) {
		const colorA = this.splitColorString(stringA);
		const colorB = this.splitColorString(stringB);
		return this.getColorStringFromArray(this.lerpColorArrays(colorA, colorB, alpha));
	}

	static lerpColorArrays(A, B, alpha) {
		return A.map((Ai, i) => Ai + alpha * (B[i] - Ai));
	}

	static setSynchroMode(newMode) {
		this.mom_hud_synchro_mode = newMode === null ? 0 : newMode;
		switch (this.mom_hud_synchro_mode) {
			case 1: // "Half-width throttle"
				this.panels.segments.forEach((segment) => (segment.style.backgroundColor = this.altColor));
				this.panels.needle.style.visibility = 'visible';
				break;
			case 2: // "Full-width throttle"
				this.panels.segments.forEach((segment) => (segment.style.backgroundColor = this.altColor));
				this.panels.needle.style.visibility = 'collapse';
				break;
			case 3: // "Strafe indicator"
				this.panels.container.style.flowChildren = 'right';
				this.panels.segments[1].style.width = 100 - this.indicatorPercentage + '%';
				this.panels.segments[2].style.width = 50 + '%';
				this.panels.segments[3].style.width = 50 + '%';
				this.panels.segments.forEach((segment) => (segment.style.backgroundColor = this.altColor));
				this.panels.needle.style.visibility = 'visible';
				break;
			case 4: // "Synchronizer"
				this.panels.container.style.flowChildren = 'right';
				this.panels.segments.forEach((segment) => {
					segment.style.width = this.maxSegmentWidth + '%';
				});
				this.panels.needle.style.visibility = 'collapse';
				break;
		}
	}

	static setSynchroColorMode(newColorMode) {
		this.mom_hud_synchro_color_enable = newColorMode === null ? 0 : newColorMode;
	}

	static setSynchroDirection(newDirection) {
		this.mom_hud_synchro_flip_enable = newDirection === null ? 0 : newDirection;
	}

	static setSynchroBufferLength(newBufferLength) {
		this.interpFrames = newBufferLength === null ? 10 : newBufferLength;
		this.sampleWeight = 1 / this.interpFrames;

		this.offsetHistory = this.initializeBuffer(this.interpFrames);
		this.gainRatioHistory = this.initializeBuffer(this.interpFrames);
		this.syncDeltaHistory = this.initializeBuffer(this.interpFrames);
		this.strafeRatioHistory = this.initializeBuffer(this.interpFrames);
	}

	static initializeSettings() {
		this.setSynchroMode(GameInterfaceAPI.GetSettingFloat('mom_hud_synchro_mode'));
		this.setSynchroColorMode(GameInterfaceAPI.GetSettingFloat('mom_hud_synchro_color_enable'));
		this.setSynchroDirection(GameInterfaceAPI.GetSettingFloat('mom_hud_synchro_flip_enable'));
		this.setSynchroBufferLength(GameInterfaceAPI.GetSettingFloat('mom_hud_synchro_buffer_size'));
	}

	static {
		$.RegisterEventHandler('ChaosHudProcessInput', $.GetContextPanel(), this.onUpdate.bind(this));

		$.RegisterForUnhandledEvent('OnSynchroModeChanged', this.setSynchroMode.bind(this));
		$.RegisterForUnhandledEvent('OnSynchroColorModeChanged', this.setSynchroColorMode.bind(this));
		$.RegisterForUnhandledEvent('OnSynchroDirectionChanged', this.setSynchroDirection.bind(this));
		$.RegisterForUnhandledEvent('OnSynchroBufferChanged', this.setSynchroBufferLength.bind(this));
		$.RegisterForUnhandledEvent('ChaosLevelInitPostEntity', this.onLoad.bind(this));
	}
}
