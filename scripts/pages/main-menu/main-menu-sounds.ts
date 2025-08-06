import { Page } from './main-menu';
import { randomInt } from 'util/functions';

interface AmbientSound {
	readonly name: string;
	eventID: uuid | null;
}

const AmbientSounds = {
	MainMenu: {
		name: 'MenuAmbientMain',
		eventID: null
	},
	MapSelector: {
		name: 'MenuAmbientMapSelector',
		eventID: null
	},
	Settings: {
		name: 'MenuAmbientSettings',
		eventID: null
	}
};

$.RegisterForUnhandledEvent('MainMenuPageShown', (page: Page | null) => updateAmbientSounds(page ?? 'MainMenu'));

let currentPage: Page | 'MainMenu' = 'MainMenu';
let playedMapSelectorSparkles = false;
let lastState: GameUIState;
let scheduleHandle: uuid | null = null;

$.RegisterForUnhandledEvent('GameUIStateChanged', (oldState, newState) => {
	// Source fires this event a million times, IDK why, fine to just ignore repeats.
	if (lastState === newState) return;
	else lastState = newState;

	// Special logic for case where we load a map from the pause menu.
	// Source fire switches to MAINMENU state, then LOADINGSCREEN state shortly after.
	// We don't way of detecting this behaviour vs normal PAUSEMENU -> MAINMENU (pressing
	// disconnect button) so using a schedule hack: wait until we've been in MAINMENU
	// state for 500ms, then play sounds if we've not switched to another state in the
	// meantime.
	if (oldState === GameUIState.PAUSEMENU && newState === GameUIState.MAINMENU) {
		// Time between MAINMENU to LOADINGSCREEN is about 200ms in debug so 500ms should
		// be plenty. If it takes any longer, the sound will start briefly, but change to
		// LOADINGSCREEN state will cancel it straight after.
		scheduleHandle = $.Schedule(0.5, () => {
			updateAmbientSounds(currentPage);
			scheduleHandle = null;
		});

		return;
	}

	if (scheduleHandle) {
		$.CancelScheduled(scheduleHandle);
		scheduleHandle = null;
	}

	// All these sounds use the "MainmenuAmbient" mixgroup, which stops annoying calls to
	// StopAllSounds in C++ from stopping them, e.g. on level load - Panorama gets full control.
	if (newState === GameUIState.MAINMENU) {
		updateAmbientSounds(currentPage);
	} else if (newState !== GameUIState.LOADINGSCREEN) {
		stopAmbientSounds();
	}
});

$.RegisterForUnhandledEvent('MapCache_MapLoad', () => playMapLoadSound());

function updateAmbientSounds(newPage: Page | 'MainMenu') {
	currentPage = newPage;

	// Map selector ambience is extra layer on top of main menu ambience, whilst settings ambience is a separate sound.
	if (newPage === Page.SETTINGS) {
		startAmbientSound(AmbientSounds.Settings);
		stopAmbientSound(AmbientSounds.MainMenu);
		stopAmbientSound(AmbientSounds.MapSelector);
	} else {
		stopAmbientSound(AmbientSounds.Settings);
		startAmbientSound(AmbientSounds.MainMenu);
	}

	if (newPage === Page.MAP_SELECTOR) {
		// If I'm hearing correctly and this actually works, the order here matters.
		// Main menu ambience plays before map selector in every case, which allows main menu
		// operator stack to sync with settings, then map selector syncs with main menu,
		// and I THINK we have everything synced out beautifully. Thanks Morasky!
		startAmbientSound(AmbientSounds.MapSelector);

		if (!playedMapSelectorSparkles) {
			$.PlaySoundEvent(`MapSelectLow${randomInt(1, 21)}`);
			$.PlaySoundEvent(`MapSelectHigh${randomInt(1, 21)}`);
			playedMapSelectorSparkles = true;
		}
	} else {
		stopAmbientSound(AmbientSounds.MapSelector);
	}
}

function startAmbientSound(sound: AmbientSound) {
	if (!sound.eventID && GameInterfaceAPI.GetGameUIState() === GameUIState.MAINMENU) {
		sound.eventID = $.PlaySoundEvent(sound.name);
	}
}

function stopAmbientSound(sound: AmbientSound) {
	if (sound.eventID) {
		$.StopSoundEvent(sound.eventID);
		sound.eventID = null;
	}
}

function stopAmbientSounds() {
	Object.values(AmbientSounds).forEach(stopAmbientSound);
}

function playMapLoadSound() {
	$.PlaySoundEvent('MapLoad');
}
