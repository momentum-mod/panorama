class IntroMovie {
	static {
		$.RegisterForUnhandledEvent('ShowIntroMovie', this.showIntroMovie.bind(this));
	}

	static showIntroMovie() {
		$.DispatchEvent('HideIntroMovie'); // Disable intro movie for Momentum
	}
}
