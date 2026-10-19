import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import * as MomMath from 'util/math';
import { CustomizerPropertyType } from 'common/hud-customizer';
import { DFHudComponent, DFHudStyle, getDFHudHighlights } from 'common/df-hud';

/** How close the view pitch has to be to a target to highlight it, in degrees */
const PITCH_TOLERANCE = 0.15;

@PanelHandler()
class DFPitchHandler extends DFHudComponent {
	pitchLineContainer = $('#PitchLines');

	pitchRanges: Array<[number, number]> = [];
	pitchColor: rgbaColor;
	pitchHlColor: rgbaColor;

	constructor() {
		super();

		// a full-height column, since the lines are placed by their pitch from the crosshair
		this.registerComponent(
			'#Customizer_Df_Pitch_Name',
			GamemodeCategoryToGamemode.get(GamemodeCategory.DEFRAG),
			{
				targets: this.pitchTargetStyle((ranges) => (this.pitchRanges = ranges)),
				colors: this.groupStyle('#Customizer_Colors', ['color', 'highlightColor']),
				color: this.colorStyle('#Customizer_Color', (value) => (this.pitchColor = value)),
				highlightColor: this.colorStyle('#Customizer_Df_HighlightColor', (value) => (this.pitchHlColor = value))
			},
			{ resizeX: true, moveX: true, moveY: false, description: '#Customizer_Df_Pitch_Name_Tooltip' }
		);

		const panel = $.GetContextPanel();
		getDFHudHighlights().pitch = (state) => panel.enabled && this.isOnTarget(state.viewPitch);
	}

	applyConfig() {
		const pitchLines = this.pitchLineContainer.Children();
		for (let i = pitchLines.length; i < this.pitchRanges.length; ++i) {
			$.CreatePanel('Panel', this.pitchLineContainer, `PitchTarget${i}`, {
				class: 'dfpitch__line'
			});
		}
		for (let i = this.pitchRanges.length; i < pitchLines.length; ++i) {
			pitchLines[i].DeleteAsync(0);
		}
	}

	onUpdate() {
		const state = this.getFrameState();
		if (!state.valid) return;

		this.updateView(state);

		const pitchLines = this.pitchLineContainer.Children();
		const viewPitch = state.viewPitch;
		for (let i = 0; i < Math.min(pitchLines.length, this.pitchRanges.length); ++i) {
			const [low, high] = this.pitchRanges[i];
			const line = pitchLines[i];
			const bOnTarget = this.isInRange(viewPitch, low, high);
			line.style.backgroundColor = bOnTarget ? this.pitchHlColor : this.pitchColor;

			const topPx = this.pitchToScreen(low - viewPitch);
			if (low === high) {
				// a single angle is a line centered on it
				line.style.height = '2px';
				line.style.transform = 'translatey(-1px)';
				line.style.position = `0px ${topPx}px 0px`;
			} else {
				// a range is a zone between its ends, like cgaz and snap zones
				const bottomPx = this.pitchToScreen(high - viewPitch);
				line.style.height = `${Math.max(bottomPx - topPx, 1)}px`;
				line.style.transform = 'none';
				line.style.position = `0px ${topPx}px 0px`;
			}
		}
	}

	isInRange(pitch: number, low: number, high: number): boolean {
		return pitch >= low - PITCH_TOLERANCE && pitch <= high + PITCH_TOLERANCE;
	}

	isOnTarget(pitch: number): boolean {
		return this.pitchRanges.some(([low, high]) => this.isInRange(pitch, low, high));
	}

	/** Distance from the top of the screen of a pitch this many degrees from the view */
	pitchToScreen(pitchDelta: number): number {
		const px = MomMath.mapAngleToScreenDist(
			(pitchDelta * Math.PI) / 180,
			this.halfVFov,
			this.screenY,
			this.scale,
			this.projection
		);
		return this.NaNCheck(px, 0);
	}

	/**
	 * Customizer setting for any number of pitch targets, each a min and max in tenths of a degree since number
	 * entries only hold whole numbers. Hands back each target as [low, high] in degrees; equal ends are one angle.
	 */
	pitchTargetStyle(set: (ranges: Array<[number, number]>) => void) {
		return {
			name: $.Localize('#Customizer_Df_PitchTargets'),
			type: CustomizerPropertyType.NUMBER_LIST,
			listFields: [
				{ name: $.Localize('#Customizer_Df_PitchTargetMin'), min: -900, max: 900 },
				{ name: $.Localize('#Customizer_Df_PitchTargetMax'), min: -900, max: 900 }
			],
			listLabels: {
				item: $.Localize('#Customizer_Df_PitchTarget'),
				add: $.Localize('#Customizer_Df_PitchTargetAdd'),
				none: $.Localize('#Customizer_Df_PitchTargetNone'),
				delete: $.Localize('#Customizer_Df_PitchTargetDelete')
			},
			callbackFunc: (_: GenericPanel, value: number[]) => {
				const ranges: Array<[number, number]> = [];
				// a missing or hand-edited value holds no targets
				const list = Array.isArray(value) ? value : [];
				for (let i = 0; i + 1 < list.length; i += 2) {
					const a = list[i] / 10;
					const b = list[i + 1] / 10;
					ranges.push([Math.min(a, b), Math.max(a, b)]);
				}
				set(ranges);
			},
			onChanged: () => this.applyConfig()
		} as DFHudStyle;
	}
}
