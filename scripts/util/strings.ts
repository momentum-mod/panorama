/** Turns seconds into something like "2 days" or "35 minutes". */
export function formatDuration(seconds: number): string {
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) {
		return `${minutes} ${$.Localize(minutes === 1 ? '#Time_Minute' : '#Time_Minutes')}`;
	}

	const hours = Math.round(minutes / 60);
	if (hours < 24) {
		return `${hours} ${$.Localize(hours === 1 ? '#Time_Hour' : '#Time_Hours')}`;
	}

	const days = Math.round(hours / 24);
	return `${days} ${$.Localize(days === 1 ? '#Time_Day' : '#Time_Days')}`;
}
