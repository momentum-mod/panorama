import { PanelHandler } from 'util/module-helpers';
import { Gamemode } from 'common/web/enums/gamemode.enum';
import { CustomizerPropertyType, getTextShadowFast, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { ColorPair, SyncColors } from 'common/sync-colors';
import { TimerState } from 'common/timer';
import * as MomMath from 'util/math';

/** Matches BoardStatsFlags_t in mom_shareddefs.h */
enum BoardStatsFlags {
	NONE = 0,
	LEFT_RAMP = 1 << 0,
	INTERRUPTED = 1 << 1
}

enum Grade {
	PERFECT,
	GOOD,
	OKAY,
	BAD,
	TERRIBLE
}

enum Cause {
	CLEAN,
	TOO_STEEP,
	AIMED_INTO_RAMP,
	SEAM,
	STRAFED_INTO_RAMP,
	BOUNCED_OFF
}

/** Every tuning number of the surf trainer board meter */
const BOARD_STATS = {
	/**
	 * Highest first-clip loss, in percent of the entry speed, for each grade at or below REFERENCE_SPEED,
	 * best grade first. Anything above the last limit is TERRIBLE.
	 */
	GRADE_LIMITS_PERCENT: [
		[Grade.PERFECT, 0.5],
		[Grade.GOOD, 1.5],
		[Grade.OKAY, 3],
		[Grade.BAD, 5]
	] as ReadonlyArray<readonly [Grade, number]>,
	/** Grade limits are multiplied by max(1, sqrt(entry speed / REFERENCE_SPEED)), in u/s */
	REFERENCE_SPEED: 1500,
	/** Loss, in percent of the entry speed, that empties the bar */
	FILL_SCALE_PERCENT: 10,
	/** How long the meter stays fully visible after a board, in seconds */
	HOLD_TIME: 1.5,
	/** How long the meter takes to fade out after the hold, in seconds */
	FADE_TIME: 0.5,
	/** Extra loss after the board, in u/s, needed before the window result marker is shown */
	WINDOW_MARKER_MIN_EXTRA_LOSS: 1,
	/** Line thickness of the average, best and window markers, in px */
	LINE_THICKNESS: 2
} as const;

const GRADE_INFO: Readonly<Record<Grade, { name: string; colors: ColorPair }>> = {
	[Grade.PERFECT]: { name: '#BoardStats_Grade_Perfect', colors: SyncColors.PERFECT },
	[Grade.GOOD]: { name: '#BoardStats_Grade_Good', colors: SyncColors.GOOD },
	[Grade.OKAY]: { name: '#BoardStats_Grade_Okay', colors: SyncColors.NEUTRAL },
	[Grade.BAD]: { name: '#BoardStats_Grade_Bad', colors: SyncColors.SLOW },
	[Grade.TERRIBLE]: { name: '#BoardStats_Grade_Terrible', colors: SyncColors.STOP }
};

const CAUSE_NAMES: Readonly<Record<Cause, string>> = {
	[Cause.CLEAN]: '#BoardStats_Why_Clean',
	[Cause.TOO_STEEP]: '#BoardStats_Why_TooSteep',
	[Cause.AIMED_INTO_RAMP]: '#BoardStats_Why_AimedIntoRamp',
	[Cause.SEAM]: '#BoardStats_Why_Seam',
	[Cause.STRAFED_INTO_RAMP]: '#BoardStats_Why_StrafedIntoRamp',
	[Cause.BOUNCED_OFF]: '#BoardStats_Why_BouncedOff'
};

/** Board shown while the HUD customizer is open: 3000 u/s in, falling a little too steep */
const PREVIEW_BOARD: BoardStats = {
	normal: { x: 0.8, y: 0, z: 0.6 },
	velIn: { x: -400, y: 2940, z: -400 },
	velOut: { x: -381.6, y: 2940, z: -386.2 },
	tick: 0,
	clipLoss: 2,
	accelGain: 1,
	gravityDelta: 4,
	endSpeed: 2955,
	planeChanges: 1,
	flags: BoardStatsFlags.NONE
};

/** Everything the meter and the end of run table show about one board */
interface BoardResult {
	grade: Grade;
	cause: Cause;
	speedIn: number;
	/** Speed removed by the first clip, u/s */
	lossFirst: number;
	/** lossFirst in percent of speedIn */
	lossPercent: number;
	/** Bar fill for the first clip, 0-1 */
	fill: number;
	/** Angle between the entry velocity and the ramp normal, degrees (90 = parallel to the ramp) */
	approachAngle: number;
	/** Entry speed into the ramp plane, u/s */
	intoRampSpeed: number;
	/** Shares of intoRampSpeed coming from falling (steep) and from the heading (wide), 0-1 */
	steepShare: number;
	wideShare: number;
	/** Speed lost over the whole window, u/s, or null when the window was cut short */
	windowLoss: number | null;
	/** Bar fill for the window result, 0-1, or null when the window was cut short */
	windowFill: number | null;
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

const dot = (a: vec3, b: vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

const lossToFill = (lossPercent: number) => clamp01(1 - lossPercent / BOARD_STATS.FILL_SCALE_PERCENT);

const gradient = ([top, bottom]: ColorPair) => `gradient(linear, 0% 0%, 0% 100%, from(${top}), to(${bottom}))` as color;

function analyzeBoard(stats: BoardStats): BoardResult {
	const speedIn = MomMath.magnitude(stats.velIn);
	const speedOut = MomMath.magnitude(stats.velOut);
	const lossFirst = speedIn - speedOut;
	const lossPercent = speedIn > 0 ? (lossFirst / speedIn) * 100 : 0;

	const speedScale = Math.max(1, Math.sqrt(speedIn / BOARD_STATS.REFERENCE_SPEED));
	const grade =
		BOARD_STATS.GRADE_LIMITS_PERCENT.find(([, limit]) => lossPercent <= limit * speedScale)?.[0] ?? Grade.TERRIBLE;

	const intoRamp = dot(stats.velIn, stats.normal);
	const approachAngle = speedIn > 0 ? MomMath.rad2deg(Math.acos(clamp01(Math.abs(intoRamp) / speedIn))) : 90;

	// vIn . n splits into a falling part and a heading part; only parts moving into the ramp (negative) count
	const steep = Math.max(0, -stats.velIn.z * stats.normal.z);
	const wide = Math.max(0, -(stats.velIn.x * stats.normal.x + stats.velIn.y * stats.normal.y));
	const intoTotal = steep + wide;
	const steepShare = intoTotal > 0 ? steep / intoTotal : 0;
	const wideShare = intoTotal > 0 ? wide / intoTotal : 0;

	const interrupted = (stats.flags & BoardStatsFlags.INTERRUPTED) !== 0;
	const windowLoss = interrupted ? null : speedIn - stats.endSpeed;
	const windowFill = windowLoss === null || speedIn <= 0 ? null : lossToFill((windowLoss / speedIn) * 100);

	// The biggest single cause of lost speed, in u/s
	const causes: Array<[Cause, number]> = [
		[Cause.TOO_STEEP, steepShare * lossFirst],
		[Cause.AIMED_INTO_RAMP, wideShare * lossFirst]
	];
	if (!interrupted) {
		causes.push(
			[Cause.SEAM, stats.clipLoss],
			[Cause.STRAFED_INTO_RAMP, -stats.accelGain],
			[Cause.BOUNCED_OFF, stats.flags & BoardStatsFlags.LEFT_RAMP ? Math.max(lossFirst, windowLoss ?? 0) : 0]
		);
	}
	const [biggestCause, biggestLoss] = causes.reduce((best, entry) => (entry[1] > best[1] ? entry : best));

	// Losses within the Perfect limit are not worth naming
	const [, perfectLimit] = BOARD_STATS.GRADE_LIMITS_PERCENT[0];
	const cleanLimit = (perfectLimit / 100) * speedScale * speedIn;
	const cause = biggestLoss > cleanLimit ? biggestCause : Cause.CLEAN;

	return {
		grade,
		cause,
		speedIn,
		lossFirst,
		lossPercent,
		fill: lossToFill(lossPercent),
		approachAngle,
		intoRampSpeed: Math.abs(intoRamp),
		steepShare,
		wideShare,
		windowLoss,
		windowFill
	};
}

@PanelHandler()
class BoardStatsHandler {
	readonly panels = {
		cp: $.GetContextPanel<MomHudBoardStats>(),
		container: $<Panel>('#BoardStatsContainer'),
		meter: $<Panel>('#BoardStatsMeter'),
		bar: $<Panel>('#BoardStatsBar'),
		fill: $<Panel>('#BoardStatsBarFill'),
		bestLine: $<Panel>('#BoardStatsBestLine'),
		averageLine: $<Panel>('#BoardStatsAverageLine'),
		windowMarker: $<Panel>('#BoardStatsWindowMarker'),
		grade: $<Label>('#BoardStatsGrade'),
		loss: $<Label>('#BoardStatsLoss'),
		why: $<Label>('#BoardStatsWhy'),
		run: $<Label>('#BoardStatsRun')
	};

	// Defaults are set in hud_default.kv3
	barHeight = 100;
	showWindowMarker = true;

	/** Boards of the current run, oldest first */
	runBoards: BoardResult[] = [];
	lastTimerState = TimerState.DISABLED;
	fadeHandle: uuid | null = null;
	preview = false;

	constructor() {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: $.Localize('#Customizer_Board_Stats_Name'),
			resizeX: false,
			resizeY: false,
			gamemode: Gamemode.SURF,
			events: {
				event: 'OnBoardStatsUpdate',
				panel: this.panels.container,
				callbackFn: (stats) => this.onBoard(stats)
			},
			unhandledEvents: [
				{ event: 'LevelInitPostEntity', callbackFn: () => this.resetRun() },
				{ event: 'OnObservedTimerReplaced', callbackFn: () => this.onTimerReplaced() },
				{ event: 'OnObservedTimerStateChange', callbackFn: () => this.onTimerStateChange() },
				{ event: 'HudCustomizer_Opened', callbackFn: () => this.setPreview(true) },
				{ event: 'HudCustomizer_Closed', callbackFn: () => this.setPreview(false) }
			],
			dynamicStyles: {
				barWidth: {
					name: $.Localize('#Customizer_Width'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '#BoardStatsBar',
					styleProperty: 'width',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 2, max: 100 }
				},
				barHeight: {
					name: $.Localize('#Customizer_Height'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '#BoardStatsBar',
					styleProperty: 'height',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 10, max: 500 },
					callbackFunc: (_, value) => (this.barHeight = value),
					onChanged: () => this.refreshPreview()
				},
				toggleLabels: {
					name: $.Localize('#Customizer_Board_Stats_ToggleLabels'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'showGrade' },
						{ styleID: 'showLoss' },
						{ styleID: 'showWhy' },
						{ styleID: 'showRun' },
						{ styleID: 'showWindowMarker' }
					]
				},
				showGrade: {
					name: $.Localize('#Customizer_Board_Stats_ShowGrade'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#BoardStatsGrade',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showLoss: {
					name: $.Localize('#Customizer_Board_Stats_ShowLoss'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#BoardStatsLoss',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showWhy: {
					name: $.Localize('#Customizer_Board_Stats_ShowWhy'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#BoardStatsWhy',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showRun: {
					name: $.Localize('#Customizer_Board_Stats_ShowRun'),
					type: CustomizerPropertyType.CHECKBOX,
					targetPanel: '#BoardStatsRun',
					callbackFunc: (panel, value) => panel.SetHasClass('hide', !value)
				},
				showWindowMarker: {
					name: $.Localize('#Customizer_Board_Stats_ShowWindowMarker'),
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (this.showWindowMarker = value),
					onChanged: () => this.refreshPreview()
				},
				fontStyling: {
					name: $.Localize('#Customizer_FontStyling'),
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'font' }, { styleID: 'fontSize' }, { styleID: 'fontColor' }]
				},
				font: {
					name: $.Localize('#Customizer_Font'),
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.boardstats__label',
					styleProperty: 'fontFamily',
					valueFn: (value) => `"${value}"`
				},
				fontSize: {
					name: $.Localize('#Customizer_FontSize'),
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.boardstats__label',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 7, max: 40 }
				},
				fontColor: {
					// The grade label is colored by its grade instead
					name: $.Localize('#Customizer_FontColor'),
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.boardstats__label--text',
					styleProperty: 'color',
					callbackFunc: (panel, value) =>
						(panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9))
				}
			}
		});
	}

	onBoard(stats: BoardStats) {
		const result = analyzeBoard(stats);

		if (this.isRecording()) this.runBoards.push(result);

		if (this.preview) return;

		this.show(result);
		this.scheduleFade();
	}

	/** Boards only count toward the run while it runs, or always when the map has no timer running at all */
	isRecording(): boolean {
		return this.lastTimerState === TimerState.RUNNING || this.lastTimerState === TimerState.DISABLED;
	}

	onTimerStateChange() {
		const state = MomentumTimerAPI.GetObservedTimerStatus().state;
		if (state === TimerState.RUNNING && this.lastTimerState !== TimerState.RUNNING) this.resetRun();
		this.lastTimerState = state;
	}

	onTimerReplaced() {
		this.lastTimerState = MomentumTimerAPI.GetObservedTimerStatus().state;
		this.resetRun();
	}

	resetRun() {
		this.runBoards = [];
	}

	runSummary(): { average: number; best: number } | null {
		if (this.runBoards.length === 0) return null;

		const fills = this.runBoards.map((board) => board.fill);
		return { average: fills.reduce((sum, fill) => sum + fill, 0) / fills.length, best: Math.max(...fills) };
	}

	show(result: BoardResult) {
		const { cp, meter, fill, bestLine, averageLine, windowMarker, grade, why, run } = this.panels;
		const info = GRADE_INFO[result.grade];

		fill.style.height = `${(result.fill * 100).toFixed(2)}%`;
		fill.style.backgroundColor = gradient(info.colors);

		grade.text = $.Localize(info.name);
		grade.style.color = info.colors[1];
		grade.style.textShadowFast = getTextShadowFast(info.colors[1] as rgbaColor, 0.9);

		cp.SetDialogVariable('board_loss_ups', Math.max(result.lossFirst, 0).toFixed(0));
		cp.SetDialogVariable('board_loss_percent', Math.max(result.lossPercent, 0).toFixed(1));
		why.text = $.Localize(CAUSE_NAMES[result.cause]);

		const extraLoss = result.windowLoss === null ? 0 : result.windowLoss - result.lossFirst;
		const showWindow =
			this.showWindowMarker &&
			result.windowFill !== null &&
			extraLoss >= BOARD_STATS.WINDOW_MARKER_MIN_EXTRA_LOSS;
		windowMarker.SetHasClass('hide', !showWindow);
		if (showWindow) this.placeLine(windowMarker, result.windowFill!);

		const summary = this.runSummary();
		averageLine.SetHasClass('hide', !summary);
		bestLine.SetHasClass('hide', !summary);
		if (summary) {
			this.placeLine(averageLine, summary.average);
			this.placeLine(bestLine, summary.best);
			cp.SetDialogVariable('board_run_average', (summary.average * 100).toFixed(0));
			cp.SetDialogVariable('board_run_best', (summary.best * 100).toFixed(0));
		}
		run.SetHasClass('boardstats__label--empty', !summary);

		meter.style.transitionDuration = '0s';
		meter.RemoveClass('boardstats__meter--hide');
	}

	/** Puts a marker line at a bar fill fraction, measured from the bottom */
	placeLine(line: GenericPanel, fillFraction: number) {
		const top = (1 - fillFraction) * this.barHeight - BOARD_STATS.LINE_THICKNESS / 2;
		line.style.marginTop = `${top.toFixed(1)}px`;
	}

	scheduleFade() {
		this.cancelFade();
		this.fadeHandle = $.Schedule(BOARD_STATS.HOLD_TIME, () => {
			this.fadeHandle = null;
			this.hide(false);
		});
	}

	cancelFade() {
		if (this.fadeHandle === null) return;
		$.CancelScheduled(this.fadeHandle);
		this.fadeHandle = null;
	}

	hide(instant: boolean) {
		this.panels.meter.style.transitionDuration = instant ? '0s' : `${BOARD_STATS.FADE_TIME}s`;
		this.panels.meter.AddClass('boardstats__meter--hide');
	}

	setPreview(enable: boolean) {
		this.preview = enable;
		this.cancelFade();

		if (enable) this.show(analyzeBoard(PREVIEW_BOARD));
		else this.hide(true);
	}

	refreshPreview() {
		if (this.preview) this.show(analyzeBoard(PREVIEW_BOARD));
	}
}
