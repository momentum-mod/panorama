import { PanelHandler } from 'util/module-helpers';
import { Gamemode } from 'common/web/enums/gamemode.enum';
//import { RegisterEventForGamemodes } from 'util/register-for-gamemodes';
import { RegisterHUDPanelForGamemode } from '../util/register-for-gamemodes';
import { Button } from 'common/buttons';

@PanelHandler()
class AhopSprint {
	readonly panels = {
		sprint: $<Panel>('#AhopSprint'),
		sprintLeft: $<Panel>('#AhopSprintLeft'),
		sprintRight: $<Panel>('#AhopSprintRight')
	};

	sprintWasActive = false;
	sprintInactive = false;

	distance: number;
	size: number;
	thickness: number;
	rotation: number;
	arcLength: number;

	//How does this magic type work? Cgaz uses it but I can't figure it out
	activeColor: rgbaColor;
	disabledColor: rgbaColor;
	blockedColor: rgbaColor;
	availableColor: rgbaColor;

	constructor() {
		RegisterHUDPanelForGamemode({
			onLoad: () => this.onLoad(),
			gamemodes: [Gamemode.AHOP],
			handledEvents: [
				{
					event: 'HudProcessInput',
					panel: $.GetContextPanel(),
					callback: () => this.onUpdate()
				}
			]
		});
		$.Msg('WTF???');
		//$.RegisterForUnhandledEvent('OnAhopHUDSettingsChange', () => this.updateSettings());
	}

	updateSettings() {
		this.distance = 68;
		this.size = 56;
		this.thickness = 2.5;
		this.rotation = 0;
		this.arcLength = 120;

		this.activeColor = '#7aee7a';
		this.disabledColor = '#7e7e7e';
		this.blockedColor = '#ff6a6a';
		this.availableColor = '#1896d3';

		//this.distance = GameInterfaceAPI.GetSettingFloat('mom_hud_ahop_distance');
		//this.size = GameInterfaceAPI.GetSettingFloat('mom_hud_ahop_size');
		//this.rotation = GameInterfaceAPI.GetSettingFloat('mom_hud_ahop_rotation');
		//this.thickness = GameInterfaceAPI.GetSettingFloat('mom_hud_ahop_thickness');
		//this.arcLength = GameInterfaceAPI.GetSettingFloat('mom_hud_ahop_arclength');

		// === TODO: CGAZ COLORS RETURN A NUMBER, I HAVE NO IDEA HOW rgbaColor TYPE WORKS, IT'S NOT DEFINED PROPERLY AND VSC DOESN'T RECOGNIZE IT ===
		// === CGAZ USES EVENTS FOR EVERY SETTING, IS THAT SOMETHING THAT NEEDS TO BE DONE HERE? ===
		//this.activeColor = GameInterfaceAPI.GetSettingString('mom_hud_ahop_active_color')
		//this.disabledColor = GameInterfaceAPI.GetSettingString('mom_hud_ahop_disabled_color')
		//this.blockedColor = GameInterfaceAPI.GetSettingString('mom_hud_ahop_blocked_color')
		//this.availableColor = GameInterfaceAPI.GetSettingString('mom_hud_ahop_available_color')

		this.updateStyles();
	}

	updateStyles() {
		this.panels.sprint.style.width = this.distance + 'px';

		this.panels.sprint.style.height = Math.max(this.distance, this.size) + 'px';

		Object.values(this.panels).forEach((panel, index) => {
			if (index === 0) return;

			panel.style.width = Math.min(this.distance, this.size) + 'px';
			panel.style.height = this.size + 'px';
			panel.style.borderWidth = this.thickness + 'px';
			panel.style.borderStyle = 'solid';
		});

		this.updateArcLength();
		this.panels.sprint.style.transform = 'rotateZ(' + this.rotation + 'deg)';
	}

	updateArcLength() {
		const leftStart = Math.ceil(270 + this.arcLength / 2);
		const rightStart = Math.ceil(90 + this.arcLength / 2);
		const clipLength = 360 - this.arcLength;

		this.panels.sprintLeft.style.clip = 'radial(50% 50%,' + leftStart + 'deg,' + clipLength + 'deg)';
		this.panels.sprintRight.style.clip = 'radial(50% 50%,' + rightStart + 'deg,' + clipLength + 'deg)';
	}

	onLoad() {
		Object.values(this.panels).forEach((panel, index) => {
			panel.style.align = 'center center';
			panel.style.borderRadius = '50%';
		});

		this.panels.sprintLeft.style.horizontalAlign = 'left';
		this.panels.sprintRight.style.horizontalAlign = 'right';

		this.updateSettings();
		$.Msg('WTF');
	}

	onUpdate() {
		// === TODO: REWRITE ALL OF THIS AFTER MOVEMENT API IS ADDED ===
		const buttons = MomentumInputAPI.GetButtons().physicalButtons;

		const walkPressed = !!(buttons & Button.WALK);
		const speedPressed = !!(buttons & Button.SPEED);
		const duckPressed = !!(buttons & Button.DUCK);

		const isDucking = MomentumPlayerAPI.IsDucking();
		//const isWalking = MomentumPlayerAPI.IsWalking();
		// const IsSprinting = MomentumPlayerAPI.IsSprinting();

		// $.Msg(isWalking);
		const isVaulting = isDucking && !duckPressed;

		//Disable sprint if manually ducking or vaulting without sprint active
		//Doesn't handle manually pressing duck during vaulting which doesn't deactivate sprint
		if ((isDucking && duckPressed) || (isVaulting && !this.sprintWasActive)) {
			if (!speedPressed) this.setSprintState(this.disabledColor);
			else {
				this.setSprintState(this.blockedColor);
				this.sprintInactive = true;
			}
			this.sprintWasActive = false;
			return;
		}

		//Doesn't handle toggle_walk, should be fixed with MomentumPlayerAPI.IsWalking
		if (walkPressed && !this.sprintWasActive) {
			this.setSprintState(this.disabledColor);
			this.sprintWasActive = false;
		}

		//Jumping on flat ground then landing doesn't allow for sprinting if sprint is pressed on the same tick as landing
		//This is probably the correct behavior and will be fixed by MomentumPlayerAPI.IsSprinting but could be an engine bug
		//I have no idea if it's consistant with hl2
		if (speedPressed) {
			if ((walkPressed && !this.sprintWasActive) || this.sprintInactive) {
				this.setSprintState(this.blockedColor);
				this.sprintInactive = true;
			} else {
				this.setSprintState(this.activeColor);
				this.sprintWasActive = true;
			}
			return;
		} else {
			this.sprintWasActive = false;
			this.sprintInactive = false;

			if (!walkPressed) this.setSprintState(this.availableColor);
		}
	}

	setSprintState(color) {
		this.panels.sprintLeft.style.borderColor = color;
		this.panels.sprintRight.style.borderColor = color;
	}
}
