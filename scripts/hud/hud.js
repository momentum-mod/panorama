'use strict';

class Hud {
	/** @type {ChaosBackbufferImagePanel} @static */
	static backBuffer = $('#HudBackBuffer');
	/** @type {HudLeaderboards} @static */
	static leaderboards = $('#Leaderboards');

	static {
		$.RegisterForUnhandledEvent(
			'ChaosHudProcessInput',
			() => (this.backBuffer.visible = this.leaderboards.visible)
		);
	}
}
