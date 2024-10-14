/**
 * Format time (in milliseconds) to a human readable format e.g. (12:34:56)
 */
export function timetoHHMMSS(input: number): string {
	const hours = Math.trunc(input / 3600);
	const minutes = Math.trunc((input / 60) % 60);
	const seconds = Math.trunc(input % 60);
	const millis = input.toFixed(2).split('.')[1];
	if (hours > 0) {
		return `${padNum(hours)}:${padNum(minutes)}:${padNum(seconds)}`;
	} else if (minutes > 0) {
		return `${padNum(minutes)}:${padNum(seconds)}.${millis}`;
	} else {
		return `${seconds}.${millis}`;
	}
}

function padNum(num: number): string {
	return num.toString().padStart(2, '0');
}
