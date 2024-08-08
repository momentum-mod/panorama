class IntroMovie {
constructor() {
		$.RegisterForUnhandledEvent('ShowIntroMovie', this.showIntroMovie.bind(this));
	}

showIntroMovie() {
		$.DispatchEvent('HideIntroMovie'); // Disable intro movie for Momentum
	}
}
