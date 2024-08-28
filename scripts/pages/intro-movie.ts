import { PanelHandler } from 'util/module-helpers';

@PanelHandler()
class IntroMovieHandler {
	constructor() {
		$.RegisterForUnhandledEvent('ShowIntroMovie', () => this.showIntroMovie());
	}

	showIntroMovie() {
		$.DispatchEvent('HideIntroMovie'); // Disable intro movie for Momentum
	}
}
