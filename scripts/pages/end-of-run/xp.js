const BASE_LEVELUP_TIME = 3;
const LEVEL_INDICATOR_MAX_TRANSITION_TIME = 0.7;
const XP_COUNTER_TICKS = 100;

class EndOfRunXP {
	static xpData;
	static primaryWidth;
	static panels = {
		cp: $.GetContextPanel(),
		levelIndicator: $('#LevelIndicator'),
		levelBar: $('#LevelBar'),
		primaryBar: $('#PrimaryBar'),
		secondaryBar: $('#SecondaryBar'),
		xpInfoBar: $('#XPInfoBar'),
		xpCounter: $('#XPCounter'),
		newStats: { newXP: $('#NewXP') }
	};

	static {
		$.RegisterForUnhandledEvent('EndOfRun_Show', this.initialize.bind(this));
		$.RegisterForUnhandledEvent('EndOfRun_Result_RunUpload', this.onRunDataReceived.bind(this));
	}

	static initialize() {
		for (const panel of Object.values(this.panels.newStats)) panel.AddClass('endofrun-xp__new-stat--hidden');

		this.xpData = this.getXPData();

		this.panels.levelIndicator.jsClass.setLevel(this.xpData.level);

		this.primaryWidth =
			((this.xpData.xp - this.xpData.currLevelXP) / (this.xpData.nextLevelXP - this.xpData.currLevelXP)) * 100;
		this.panels.primaryBar.style.width = `${this.primaryWidth}%`;
		this.panels.secondaryBar.style.width = '0%';

		this.panels.cp.AddClass('endofrun-xp--hidden');
	}

	static onRunDataReceived(uploaded, cosXp, _rankXp, lvlGain) {
		const setTimingFunction = (str) => (this.panels.secondaryBar.style.transitionTimingFunction = str);

		const widthAnimation = (width, duration) =>
			new Promise((resolve) => {
				this.panels.secondaryBar.style.transitionDuration = `${duration}s`;
				this.panels.secondaryBar.style.width = `${width}%`;

				$.Schedule(duration, () => {
					this.panels.secondaryBar.style.transitionDuration = '0s';
					resolve();
				});
			});

		const levelUp = (duration) => {
			this.panels.primaryBar.style.width = '0%';
			this.panels.secondaryBar.style.width = '0%';
			this.panels.levelIndicator.jsClass.incrementLevel(duration);
		};

		const endLevelUpAnimation = (isLevelUp) => {
			const lerp =
				(newXP.xp - (isLevelUp ? newXP.currLevelXP : oldXP.xp)) / (newXP.nextLevelXP - newXP.currLevelXP);
			const duration = BASE_LEVELUP_TIME;

			setTimingFunction('ease-out');
			return widthAnimation(lerp * 100, duration);
		};

		const runXPCounter = (startXP, endXP, totalLevelXP, duration) => {
			const iterations = duration * XP_COUNTER_TICKS;
			const range = endXP - startXP;
			this.panels.xpCounter.SetDialogVariableInt('total_xp', totalLevelXP);

			for (let i = 0; i <= iterations; i++) {
				// Could use a dialog variable here, but I'm guessing setting the text directly is faster?
				$.Schedule(i / XP_COUNTER_TICKS, () =>
					this.panels.xpCounter.SetDialogVariableInt(
						'xp_counter',
						Math.round((i / iterations) * range + startXP)
					)
				);
			}
		};

		const oldXP = this.xpData;

		const level = this.xpData.level + lvlGain;

		const newXP = {
			level: level,
			xp: this.xpData.xp + cosXp,
			currLevelXP: MomentumAPI.GetCosmeticXpForLevel(level),
			nextLevelXP: MomentumAPI.GetCosmeticXpForLevel(level + 1)
		};

		// If run didn't upload or we didn't gain any XP, return.
		if (!uploaded || oldXP.xp === newXP.xp) return;

		const levelDiff = newXP.level - oldXP.level;

		this.panels.cp.RemoveClass('endofrun-xp--hidden');

		this.panels.cp.SetDialogVariableInt('new_xp', newXP.xp - oldXP.xp);

		if (levelDiff === 0) {
			runXPCounter(oldXP.xp, newXP.xp, newXP.nextLevelXP, BASE_LEVELUP_TIME);
			endLevelUpAnimation(false);
		} else {
			setTimingFunction('ease-in');

			const lerp = (oldXP.xp - oldXP.currLevelXP) / (oldXP.nextLevelXP - oldXP.currLevelXP);
			const initialDuration = (1 - lerp) * BASE_LEVELUP_TIME;

			runXPCounter(oldXP.xp, oldXP.nextLevelXP, oldXP.nextLevelXP, initialDuration);

			if (levelDiff === 1) {
				widthAnimation(100 - this.primaryWidth, lerp * initialDuration).then(() => {
					levelUp(LEVEL_INDICATOR_MAX_TRANSITION_TIME);
					runXPCounter(newXP.currLevelXP, newXP.xp, newXP.nextLevelXP, BASE_LEVELUP_TIME);
					endLevelUpAnimation(true);
				});
			} else {
				let chain = widthAnimation(100 - this.primaryWidth, initialDuration).then(() =>
					setTimingFunction('ease-in-out')
				);
				for (let i = 1; i < levelDiff; i++)
					chain = chain.then(() => {
						// Smallest fraction of BASE_LEVELUP_TIME a level up duration can be
						const phi = 5;
						// Quadratic passing 0 and leveldiff at BASE_LEVELUP_TIME, phi adjusts curviness
						// Doesn't work great but hard to get right without a bunch more maths or being able to time all the levels in one
						// animation, maybe that's possible with some very creative CSS?
						const duration =
							((4 * BASE_LEVELUP_TIME) / levelDiff ** 2) * (1 - 1 / phi) * (i ** 2 - levelDiff * i) +
							BASE_LEVELUP_TIME;

						levelUp(Math.min(duration / 2, LEVEL_INDICATOR_MAX_TRANSITION_TIME));

						const endXP = MomentumAPI.GetCosmeticXpForLevel(oldXP.level + i + 1);

						runXPCounter(MomentumAPI.GetCosmeticXpForLevel(oldXP.level + i), endXP, endXP, duration);

						return widthAnimation(100, duration);
					});
				chain.then(() => {
					levelUp(LEVEL_INDICATOR_MAX_TRANSITION_TIME);
					runXPCounter(newXP.currLevelXP, newXP.xp, newXP.nextLevelXP, BASE_LEVELUP_TIME);
					endLevelUpAnimation(true);
				});
			}
		}
	}

	static getXPData() {
		const level = MomentumAPI.GetPlayerLevel();
		return {
			level: level,
			xp: MomentumAPI.GetPlayerXp(),
			currLevelXP: MomentumAPI.GetCosmeticXpForLevel(level),
			nextLevelXP: MomentumAPI.GetCosmeticXpForLevel(level + 1)
		};
	}
}
