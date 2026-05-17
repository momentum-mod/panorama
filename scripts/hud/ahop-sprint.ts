import { PanelHandler } from 'util/module-helpers';
import { GamemodeCategory, GamemodeCategoryToGamemode } from 'common/web/enums/gamemode.enum';
import { registerHUDCustomizerComponent, CustomizerPropertyType } from 'common/hud-customizer';
import { Button } from 'common/buttons';

enum SprintState {
	ACTIVE,
	DISABLED,
	BLOCKED,
	AVAILABLE
}

type StateValue = {
	curve: rgbaColor;
	dot: rgbaColor;
};

const StateColors: Record<SprintState, StateValue> = {
	[SprintState.ACTIVE]: {
		curve: 'rgba(0, 0, 0, 0)',
		dot: 'rgba(0, 0, 0, 0)'
	},
	[SprintState.DISABLED]: {
		curve: 'rgba(0, 0, 0, 0)',
		dot: 'rgba(0, 0, 0, 0)'
	},
	[SprintState.BLOCKED]: {
		curve: 'rgba(0, 0, 0, 0)',
		dot: 'rgba(0, 0, 0, 0)'
	},
	[SprintState.AVAILABLE]: {
		curve: 'rgba(0, 0, 0, 0)',
		dot: 'rgba(0, 0, 0, 0)'
	}
};

const Config = {
	type: 'curve',
	curve: {
		gap: 68,
		size: 56,
		thickness: 2.5,
		rotation: 0,
		arcLength: 120
	},
	dot: {
		width: 24,
		height: 24,
		borderRadius: 50,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 1)'
	}
};

@PanelHandler()
class AhopSprint {
	readonly panels = {
		curveWrapper: $<Panel>('#AhopSprintCurveWrapper'),
		curvePanels: {
			curveLeft: $<Panel>('#AhopSprintLeft'),
			curveRight: $<Panel>('#AhopSprintRight')
		},
		dot: $<Panel>('#AhopSprintDot')
	};

	constructor() {
		registerHUDCustomizerComponent($.GetContextPanel(), {
			name: 'Sprint Indicator',
			resizeX: false,
			resizeY: false,
			gamemode: GamemodeCategoryToGamemode.get(GamemodeCategory.AHOP),
			events: { event: 'HudProcessInput', panel: $.GetContextPanel(), callbackFn: () => this.onUpdate() },
			dynamicStyles: {
				type: {
					name: 'Type',
					type: CustomizerPropertyType.DROPDOWN,
					options: [
						{ label: 'Curve', value: 'curve' },
						{ label: 'Dot', value: 'dot' }
					],
					children: [
						{ styleID: 'curveSize', showWhen: 'curve' },
						{ styleID: 'curveGap', showWhen: 'curve' },
						{ styleID: 'curveThickness', showWhen: 'curve' },
						{ styleID: 'curveRotation', showWhen: 'curve' },
						{ styleID: 'curveArcLength', showWhen: 'curve' },
						{ styleID: 'curveColors', showWhen: 'curve' },
						{ styleID: 'dotWidth', showWhen: 'dot' },
						{ styleID: 'dotHeight', showWhen: 'dot' },
						{ styleID: 'dotRotation', showWhen: 'dot' },
						{ styleID: 'dotBorderRadius', showWhen: 'dot' },
						{ styleID: 'dotBorderWidth', showWhen: 'dot' },
						{ styleID: 'dotBorderColor', showWhen: 'dot' },
						{ styleID: 'dotColors', showWhen: 'dot' }
					],
					callbackFunc: (_, value) => {
						Config.type = value;
						this.updateStyles();
					}
				},

				// TYPE - CURVE
				curveSize: {
					name: 'Size',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.curve.size = value;
						this.updateStyles();
					}
				},
				curveGap: {
					name: 'Gap',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.curve.gap = value;
						this.updateStyles();
					}
				},
				curveThickness: {
					name: 'Thickness',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.curve.thickness = value / 10;
						this.updateStyles();
					}
				},
				curveRotation: {
					name: 'Rotation',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.curve.rotation = value;
						this.updateStyles();
					}
				},
				curveArcLength: {
					name: 'Arc Length',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.curve.arcLength = value;
						this.updateStyles();
					}
				},
				curveColors: {
					name: 'State Colors',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'curveActiveColor' },
						{ styleID: 'curveAvailableColor' },
						{ styleID: 'curveDisabledColor' },
						{ styleID: 'curveBlockedColor' }
					]
				},
				curveActiveColor: {
					name: 'Active',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						StateColors[SprintState.ACTIVE].curve = value as rgbaColor;
					}
				},
				curveAvailableColor: {
					name: 'Available',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						StateColors[SprintState.AVAILABLE].curve = value as rgbaColor;
					}
				},
				curveDisabledColor: {
					name: 'Disabled',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						StateColors[SprintState.DISABLED].curve = value as rgbaColor;
					}
				},
				curveBlockedColor: {
					name: 'Blocked',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						StateColors[SprintState.BLOCKED].curve = value as rgbaColor;
					}
				},

				// TYPE - DOT
				dotWidth: {
					name: 'Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.dot.width = value;
						this.updateStyles();
					}
				},
				dotHeight: {
					name: 'Height',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.dot.height = value;
						this.updateStyles();
					}
				},
				dotBorderRadius: {
					name: 'Border Radius',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.dot.borderRadius = value;
						this.updateStyles();
					},
					settingProps: { min: 0, max: 50 }
				},
				dotBorderWidth: {
					name: 'Border Width',
					type: CustomizerPropertyType.NUMBER_ENTRY,
					callbackFunc: (_, value) => {
						Config.dot.borderWidth = value;
						this.updateStyles();
					}
				},
				dotBorderColor: {
					name: 'Border Color',
					type: CustomizerPropertyType.COLOR_PICKER,
					callbackFunc: (_, value) => {
						Config.dot.borderColor = value;
						this.updateStyles();
					}
				},
				dotGradients: {
					name: 'State Gradients',
					type: CustomizerPropertyType.NONE,
					expandable: true,
					children: [
						{ styleID: 'dotActiveGradient' },
						{ styleID: 'dotAvailableGradient' },
						{ styleID: 'dotDisabledGradient' },
						{ styleID: 'dotBlockedGradient' }
					]
				},
				dotActiveGradient: {
					name: 'Active',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[SprintState.ACTIVE].dot =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))` as rgbaColor;
					}
				},
				dotAvailableGradient: {
					name: 'Available',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[SprintState.AVAILABLE].dot =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))` as rgbaColor;
					}
				},
				dotDisabledGradient: {
					name: 'Disabled',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[SprintState.DISABLED].dot =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))` as rgbaColor;
					}
				},
				dotBlockedGradient: {
					name: 'Blocked',
					type: CustomizerPropertyType.GRADIENT_PICKER,
					callbackFunc: (_, value) => {
						StateColors[SprintState.BLOCKED].dot =
							`gradient(linear, 0% 0%, 100% 0%, from (${value[0]}, to(${value[1]}))` as rgbaColor;
					}
				}
			}
		});
	}

	updateStyles() {
		if (Config.type === 'curve') {
			this.panels.curveWrapper.style.visibility = 'visible';
			this.panels.dot.style.visibility = 'collapse';
			this.updateCurveType();
		} else if (Config.type === 'dot') {
			this.panels.curveWrapper.style.visibility = 'collapse';
			this.panels.dot.style.visibility = 'visible';
			this.updateDotType();
		}
	}

	updateCurveType() {
		this.panels.curveWrapper.style.width = `${Config.curve.gap}px`;

		Object.values(this.panels.curvePanels).forEach((panel) => {
			panel.style.width = `${Math.min(Config.curve.gap, Config.curve.size)}px`;
			panel.style.height = `${Config.curve.size}px`;
			panel.style.borderWidth = `${Config.curve.thickness}px`;
			panel.style.borderStyle = 'solid';
		});

		const leftStart = Math.ceil(270 + Config.curve.arcLength / 2);
		const rightStart = Math.ceil(90 + Config.curve.arcLength / 2);
		const clipLength = 360 - Config.curve.arcLength;

		this.panels.curvePanels.curveLeft.style.clip = `radial(50% 50%,${leftStart}deg,${clipLength}deg)`;
		this.panels.curvePanels.curveRight.style.clip = `radial(50% 50%,${rightStart}deg,${clipLength}deg)`;

		this.panels.curveWrapper.style.transform = `rotateZ(${Config.curve.rotation}deg)`;
	}

	updateDotType() {
		const dot = this.panels.dot;

		dot.style.width = `${Config.dot.width}px`;
		dot.style.height = `${Config.dot.height}px`;
		dot.style.border = `${Config.dot.borderWidth}px solid ${Config.dot.borderColor}`;
		dot.style.borderRadius = `${Config.dot.height * (Config.dot.borderRadius / 100)}px`;
	}

	onUpdate() {
		const { physicalButtons, toggledButtons, disabledButtons } = MomentumInputAPI.GetButtons();
		const speedPressed = !!((physicalButtons | toggledButtons) & Button.SPEED);
		const speedDisabled = !!(disabledButtons & Button.SPEED);

		const isDucking = MomentumPlayerAPI.IsDucking();
		const isWalking = MomentumPlayerAPI.IsWalking();
		const isSprinting = MomentumPlayerAPI.IsSprinting();

		const state: SprintState = isSprinting
			? SprintState.ACTIVE
			: speedPressed
				? SprintState.BLOCKED
				: isDucking || isWalking || speedDisabled
					? SprintState.DISABLED
					: SprintState.AVAILABLE;

		const color = StateColors[state][Config.type];

		if (Config.type === 'curve') {
			this.panels.curvePanels.curveLeft.style.borderColor = color;
			this.panels.curvePanels.curveRight.style.borderColor = color;
		}

		if (Config.type === 'dot') {
			this.panels.dot.style.backgroundColor = color;
		}
	}
}
