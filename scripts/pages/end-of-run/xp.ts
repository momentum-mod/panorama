import { PanelHandler, OnPanelLoad } from 'util/module-helpers';

@PanelHandler()
class EndOfRunXPHandler implements OnPanelLoad {
	xpData: ReturnType<typeof this.getXPData>;
	primaryWidth: number;

	readonly baseLevelUpTime = 3;
	readonly levelIndicatorMaxTransitionTime = 0.7;
	readonly xpCounterTicks = 100;

	readonly panels = {
		cp: $.GetContextPanel(),
		levelIndicator: $<LevelIndicator>('#LevelIndicator'),
		levelBar: $<Panel>('#LevelBar'),
		primaryBar: $<Panel>('#PrimaryBar'),
		secondaryBar: $<Panel>('#SecondaryBar'),
		xpInfoBar: $('#XPInfoBar'),
		xpCounter: $<Panel>('#XPCounter'),
		newStats: { newXP: $<Panel>('#NewXP') }
	};

	constructor() {
		$.RegisterForUnhandledEvent('EndOfRun_Show', () => this.initialize());
		$.RegisterForUnhandledEvent('EndOfRun_Result_RunUpload', (uploaded, cosXP, rankXP, lvlGain) =>
			this.onRunDataReceived(uploaded, cosXP, rankXP, lvlGain)
		);
	}

	onPanelLoad() {
		this.initialize();
	}

	initialize() {
		Object.values(this.panels.newStats).forEach((panel) => panel.AddClass('endofrun-xp__new-stat--hidden'));

		this.xpData = this.getXPData();

		this.panels.levelIndicator.handler.setLevel(this.xpData.level);

		this.primaryWidth =
			((this.xpData.xp - this.xpData.currLevelXP) / (this.xpData.nextLevelXP - this.xpData.currLevelXP)) * 100;
		this.panels.primaryBar.style.width = `${this.primaryWidth}%`;
		this.panels.secondaryBar.style.width = '0%';

		this.panels.cp.AddClass('endofrun-xp--hidden');
	}

	onRunDataReceived(uploaded: boolean, cosXp: number, _rankXp: number, lvlGain: number) {
		const setTimingFunction = (str: string) => (this.panels.secondaryBar.style.transitionTimingFunction = str);

		const widthAnimation = (width: number, duration: number): Promise<void> =>
			new Promise((resolve) => {
				this.panels.secondaryBar.style.transitionDuration = `${duration}s`;
				this.panels.secondaryBar.style.width = `${width}%`;

				$.Schedule(duration, () => {
					this.panels.secondaryBar.style.transitionDuration = '0s';
					resolve();
				});
			});

		const levelUp = (duration: number) => {
			this.panels.primaryBar.style.width = '0%';
			this.panels.secondaryBar.style.width = '0%';
			this.panels.levelIndicator.handler.incrementLevel(duration);
		};

		const endLevelUpAnimation = (isLevelUp: boolean): Promise<void> => {
			const lerp =
				(newXP.xp - (isLevelUp ? newXP.currLevelXP : oldXP.xp)) / (newXP.nextLevelXP - newXP.currLevelXP);
			const duration = this.baseLevelUpTime;

			setTimingFunction('ease-out');
			return widthAnimation(lerp * 100, duration);
		};

		const runXPCounter = (startXP: number, endXP: number, totalLevelXP: number, duration: number) => {
			const iterations = duration * this.xpCounterTicks;
			const range = endXP - startXP;
			this.panels.xpCounter.SetDialogVariableInt('total_xp', totalLevelXP);

			for (let i = 0; i <= iterations; i++) {
				// Could use a dialog variable here, but I'm guessing setting the text directly is faster?
				$.Schedule(i / this.xpCounterTicks, () =>
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
			runXPCounter(oldXP.xp, newXP.xp, newXP.nextLevelXP, this.baseLevelUpTime);
			void endLevelUpAnimation(false);
		} else {
			setTimingFunction('ease-in');

			const lerp = (oldXP.xp - oldXP.currLevelXP) / (oldXP.nextLevelXP - oldXP.currLevelXP);
			const initialDuration = (1 - lerp) * this.baseLevelUpTime;

			runXPCounter(oldXP.xp, oldXP.nextLevelXP, oldXP.nextLevelXP, initialDuration);

			if (levelDiff === 1) {
				widthAnimation(100 - this.primaryWidth, lerp * initialDuration).then(() => {
					levelUp(this.levelIndicatorMaxTransitionTime);
					runXPCounter(newXP.currLevelXP, newXP.xp, newXP.nextLevelXP, this.baseLevelUpTime);
					return endLevelUpAnimation(true);
				});
			} else {
				let chain: Promise<any> = widthAnimation(100 - this.primaryWidth, initialDuration).then(() =>
					setTimingFunction('ease-in-out')
				);
				for (let i = 1; i < levelDiff; i++)
					chain = chain.then(() => {
						// Smallest fraction of this.baseLevelUpTime a level up duration can be
						const phi = 5;
						// Quadratic passing 0 and leveldiff at this.baseLevelUpTime, phi adjusts curviness
						// Doesn't work great but hard to get right without a bunch more maths or being able to time all the levels in one
						// animation, maybe that's possible with some very creative CSS?
						const duration =
							((4 * this.baseLevelUpTime) / levelDiff ** 2) * (1 - 1 / phi) * (i ** 2 - levelDiff * i) +
							this.baseLevelUpTime;

						levelUp(Math.min(duration / 2, this.levelIndicatorMaxTransitionTime));

						const endXP = MomentumAPI.GetCosmeticXpForLevel(oldXP.level + i + 1);

						runXPCounter(MomentumAPI.GetCosmeticXpForLevel(oldXP.level + i), endXP, endXP, duration);

						return widthAnimation(100, duration);
					});
				void chain.then(() => {
					levelUp(this.levelIndicatorMaxTransitionTime);
					runXPCounter(newXP.currLevelXP, newXP.xp, newXP.nextLevelXP, this.baseLevelUpTime);
					return endLevelUpAnimation(true);
				});
			}
		}
	}

	getXPData() {
		const level = MomentumAPI.GetPlayerLevel();
		return {
			level: level,
			xp: MomentumAPI.GetPlayerXp(),
			currLevelXP: MomentumAPI.GetCosmeticXpForLevel(level),
			nextLevelXP: MomentumAPI.GetCosmeticXpForLevel(level + 1)
		};
	}
}
