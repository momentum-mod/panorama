import { OnPanelLoad, PanelHandler } from 'util/module-helpers';
import { CustomizerPropertyType, registerHUDCustomizerComponent } from 'common/hud-customizer';
import { ReplayStylingInterface } from './replay-controls';
import { getTextShadowFast } from 'common/hud-customizer';

@PanelHandler()
class HudSpectateHandler implements OnPanelLoad {
	readonly panels = {
		cp: $.GetContextPanel<MomHudSpectate>(),
		avatar: $<AvatarImage>('#Avatar')!,
		statusIcon: $<Image>('#StatusIcon')!,
		prevPlayer: $<Button>('#PrevPlayer')!,
		nextPlayer: $<Button>('#NextPlayer')!,
		replayControls: $<MomHudReplayControls>('#ReplayControls')!,
		toggleReplayControls: $<Button>('#ToggleReplayControls')!,
		blur: $.GetContextPanel().GetParent()!.FindChild<HudBlurTarget>('HudBlur')!
	};

	enableBlur: boolean;
	showOnHover: boolean;

	constructor() {
		$.RegisterForUnhandledEvent('ObserverTargetChanged', () => this.update());
		$.RegisterForUnhandledEvent('MomentumSpectatorModeChanged', (newMode) => this.onSpectatorModeChange(newMode));

		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: 'Spectating Menu',
			resizeX: false,
			resizeY: false,
			moveX: false,
			moveY: true,
			canDisable: false,
			dynamicStyles: {
				showOnHover: {
					name: 'Show Only On Hover',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (this.showOnHover = value),
					onChanged: () => this.handleHoverAndBlur(this.showOnHover)
				},
				blur: {
					name: 'Enable Blur',
					type: CustomizerPropertyType.CHECKBOX,
					callbackFunc: (_, value) => (this.enableBlur = value),
					onChanged: () => this.handleHoverAndBlur(this.showOnHover)
				},
				colors: {
					name: 'Colors',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'backgroundColor' },
						{ styleID: 'replaySeekBarColor' },
						{ styleID: 'replaySeekBarColorActive' }
					]
				},
				backgroundColor: {
					name: 'Background',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => (this.panels.cp.style.backgroundColor = value as rgbaColor)
				},
				replaySeekBarColor: {
					name: 'Replay Seek Bar',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) =>
						(this.panels.replayControls as ReplayStylingInterface).setSeekBarColor(value as rgbaColor)
				},
				replaySeekBarColorActive: {
					name: 'Active Replay Segment',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						const gradient =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))` as color;
						(this.panels.replayControls as ReplayStylingInterface).setSeekBarColorActive(gradient);
					}
				},
				fontStyling: {
					name: 'Font Styling',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [{ styleID: 'spectateStyling' }, { styleID: 'replayStyling' }]
				},
				spectateStyling: {
					name: 'Spectate Panel',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'spectateFont' },
						{ styleID: 'spectateFontSize' },
						{ styleID: 'spectateFontColor' }
					]
				},
				spectateFont: {
					name: 'Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.spectate__title',
					styleProperty: 'fontFamily'
				},
				spectateFontSize: {
					name: 'Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.spectate__title',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				spectateFontColor: {
					name: 'Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: ['.spectate__title', '.spectate__hint'],
					styleProperty: 'color',
					callbackFunc: (panel, value) =>
						(panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9))
				},
				replayStyling: {
					name: 'Replay Panel',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'replayLabelStyling' },
						{ styleID: 'replayValueStyling' },
						{ styleID: 'replaySegmentStyling' }
					]
				},
				replayLabelStyling: {
					name: 'Label',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'replayLabelFont' },
						{ styleID: 'replayLabelFontSize' },
						{ styleID: 'replayLabelFontColor' }
					]
				},
				replayLabelFont: {
					name: 'Label Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: '.replaycontrols__text--typeof',
					styleProperty: 'fontFamily'
				},
				replayLabelFontSize: {
					name: 'Label Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: '.replaycontrols__text--typeof',
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`
				},
				replayLabelFontColor: {
					name: 'Label Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: '.replaycontrols__text--typeof',
					styleProperty: 'color',
					callbackFunc: (panel, value) =>
						(panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9))
				},
				replayValueStyling: {
					name: 'Value',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'replayValueFont' },
						{ styleID: 'replayValueFontSize' },
						{ styleID: 'replayValueFontColor' }
					]
				},
				replayValueFont: {
					name: 'Value Font',
					type: CustomizerPropertyType.FONT_PICKER,
					targetPanel: ['.replaycontrols__text--time', '.replaycontrols__text--ticks'],
					styleProperty: 'fontFamily'
				},
				replayValueFontSize: {
					name: 'Value Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					targetPanel: ['.replaycontrols__text--time', '.replaycontrols__text--ticks'],
					styleProperty: 'fontSize',
					valueFn: (value) => `${value}px`,
					settingProps: { min: 0, max: 18 }
				},
				replayValueFontColor: {
					name: 'Value Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					targetPanel: ['.replaycontrols__text--time', '.replaycontrols__text--ticks'],
					styleProperty: 'color',
					callbackFunc: (panel, value) =>
						(panel.style.textShadowFast = getTextShadowFast(value as rgbaColor, 0.9))
				},
				replaySegmentStyling: {
					name: 'Segments',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'replaySegmentFont' },
						{ styleID: 'replaySegmentFontSize' },
						{ styleID: 'replaySegmentFontColor' }
					]
				},
				replaySegmentFont: {
					name: 'Segment Font',
					type: CustomizerPropertyType.FONT_PICKER,
					callbackFunc: (_, value) =>
						(this.panels.replayControls as ReplayStylingInterface).setSegmentFont(value)
				},
				replaySegmentFontSize: {
					name: 'Segment Font Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) =>
						(this.panels.replayControls as ReplayStylingInterface).setSegmentFontSize(value),
					settingProps: { min: 0, max: 18 }
				},
				replaySegmentFontColor: {
					name: 'Segment Font Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) =>
						(this.panels.replayControls as ReplayStylingInterface).setSegmentFontColor(value as rgbaColor)
				}
			},
			postInit: () => this.handleHoverAndBlur(this.showOnHover)
		});
	}

	handleHoverAndBlur(fadeout: boolean) {
		if (fadeout) {
			this.panels.cp.style.opacity = 0.0001;
			this.toggleBlur(false);

			this.panels.cp.SetPanelEvent('onmouseover', () => {
				this.panels.cp.style.opacity = 1;
				this.toggleBlur(this.enableBlur);
			});
			this.panels.cp.SetPanelEvent('onmouseout', () => {
				//panorama disables the panel if opacity is 0
				this.panels.cp.style.opacity = 0.001;
				this.toggleBlur(false);
			});
		} else {
			this.panels.cp.style.opacity = 1;
			this.toggleBlur(this.enableBlur);
			this.panels.cp.ClearPanelEvent('onmouseover');
			this.panels.cp.ClearPanelEvent('onmouseout');
		}
	}

	toggleBlur(blur: boolean) {
		if (blur) this.panels.blur.AddBlurPanel(this.panels.cp);
		else this.panels.blur.RemoveBlurPanel(this.panels.cp);
	}

	onPanelLoad() {
		this.update();
	}

	update() {
		const { steamId, name, isReplay } = this.panels.cp;

		this.panels.cp.SetDialogVariable('spec_target', name);

		this.panels.avatar.steamid = steamId;

		this.panels.cp.SetDialogVariable(
			'status',
			$.Localize(isReplay ? '#Spectate_Status_WatchingReplay' : '#Spectate_Status_Spectating')
		);

		this.panels.statusIcon.SetImage(`file://{images}/${isReplay ? 'movie-open-outline' : 'eye'}.svg`);

		this.panels.prevPlayer.visible = !isReplay;
		this.panels.nextPlayer.visible = !isReplay;
		this.panels.toggleReplayControls.visible = isReplay;

		this.panels.replayControls.hidden = !isReplay;
	}

	toggleReplayControls() {
		this.panels.replayControls.hidden = !this.panels.replayControls.hidden;
	}

	onSpectatorModeChange(newMode: SpectateMode) {
		let modeText = '';
		switch (newMode) {
			case SpectateMode.IN_EYE:
				modeText = $.Localize('#OBS_IN_EYE');
				break;
			case SpectateMode.CHASE:
				modeText = $.Localize('#OBS_CHASE_LOCKED');
				break;
			case SpectateMode.ROAMING:
				modeText = $.Localize('#OBS_ROAMING');
				break;
		}

		this.panels.cp.SetDialogVariable('curr_spec_mode', modeText);
	}
}
