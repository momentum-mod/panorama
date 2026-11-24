import { truncateNumber } from 'util/math';

/** Turns seconds into hours:minutes:seconds format, ignoring hours and minutes if they are equal to 0 */
export function formatDurationDigital(rawSeconds: number, fractionalDigits: number): string {
	const total = truncateNumber(rawSeconds, fractionalDigits) ?? 0;
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = (total % 60).toFixed(fractionalDigits);

	if (hours === 0 && minutes === 0) return seconds;

	const paddedSeconds = seconds.padStart(fractionalDigits > 0 ? fractionalDigits + 3 : 2, '0');
	if (hours === 0) return `${minutes}:${paddedSeconds}`;
	return `${hours}:${minutes.toString().padStart(2, '0')}:${paddedSeconds}`;
}
