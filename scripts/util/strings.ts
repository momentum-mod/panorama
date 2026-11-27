import { truncateNumber } from 'util/math';

/**
 * Formats a duration in seconds as a digital clock string (`h:mm:ss.fff`).
 *
 * @example
 * formatDurationDigital(5.1239, 3); // "5.123"
 * formatDurationDigital(65.1239, 3); // "1:05.123"
 * formatDurationDigital(3725.5, 2); // "1:02:05.50"
 * formatDurationDigital(-0.0004, 3, true); // "-0.000"
 * formatDurationDigital(0.0004, 3, true); // "+0.000"
 * formatDurationDigital(0, 3, true); // "0.000"
 *
 * @param rawSeconds Duration in seconds. May be negative; the magnitude is what gets formatted.
 * @param fractionalDigits Number of digits shown after the decimal point (0 for none).
 * @param includeSign If true, prefix `+` for positive and `-` for negative values. The sign is taken from the raw
 * value, before truncation, so a tiny non-zero value still gets a sign. Exactly 0 never gets one.
 * @returns The formatted duration string.
 */
export function formatDurationDigital(rawSeconds: number, fractionalDigits: number, includeSign = false): string {
	const sign = includeSign ? (rawSeconds > 0 ? '+' : rawSeconds < 0 ? '-' : '') : '';
	const total = truncateNumber(Math.abs(rawSeconds), fractionalDigits) ?? 0;
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = (total % 60).toFixed(fractionalDigits);

	if (hours === 0 && minutes === 0) return sign + seconds;

	const paddedSeconds = seconds.padStart(fractionalDigits > 0 ? fractionalDigits + 3 : 2, '0');
	if (hours === 0) return `${sign}${minutes}:${paddedSeconds}`;
	return `${sign}${hours}:${minutes.toString().padStart(2, '0')}:${paddedSeconds}`;
}
