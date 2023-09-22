class IntroMovie {
	static {
		$.RegisterForUnhandledEvent('ChaosShowIntroMovie', this.showIntroMovie.bind(this));
	}

	static showIntroMovie() {
		$.DispatchEvent('ChaosHideIntroMovie'); // Disable intro movie for Momentum
	}
}
