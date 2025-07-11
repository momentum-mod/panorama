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

let currentPage: Page | 'MainMenu' = 'MainMenu';
let playedMapSelectorSparkles = false;

$.RegisterForUnhandledEvent('MainMenuPageShown', (page: Page | null) => updateAmbientSounds(page ?? 'MainMenu'));

$.RegisterForUnhandledEvent('GameUIStateChanged', (_oldState, newState) => {
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
	if (!sound.eventID) {
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
