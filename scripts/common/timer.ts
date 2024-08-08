namespace Timer {
	export enum TimerEvent {
		STARTED = 0,
		FINISHED = 1,
		STOPPED = 2,
		FAILED = 3
	}

	export enum TimerState {
		NOTRUNNING = 0,
		RUNNING = 1,
		PRACTICE = 2
	}
}
