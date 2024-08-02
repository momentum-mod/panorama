interface Globals {
	Web: typeof Web;
	Util: typeof Util;
	State: typeof State;
	Settings: typeof Settings;
	Run: typeof Run;
	Timer: typeof Timer;
	Weapon: typeof Weapon;
	Speedo: typeof Speedo;
	Buttons: typeof Buttons;
	Safeguards: typeof Safeguards;
	DontShowAgain: typeof DontShowAgain;
}

namespace __private {
	export const __globalObject = UiToolkitAPI.GetGlobalObject() as any;
	__globalObject.Globals ??= Object.freeze({
		Web,
		Util,
		State,
		Settings,
		Run,
		Timer,
		Weapon,
		Speedo,
		Buttons,
		Safeguards,
		DontShowAgain
	});
}

const Globals: Globals = __private.__globalObject.Globals;
