// Source engine language names (as returned by $.Language()) to BCP-47 tags usable by Intl
const SOURCE_LANGUAGE_TO_LOCALE: Record<string, string> = {
	english: 'en',
	german: 'de',
	french: 'fr',
	italian: 'it',
	koreana: 'ko',
	spanish: 'es',
	schinese: 'zh-CN',
	tchinese: 'zh-TW',
	russian: 'ru',
	thai: 'th',
	japanese: 'ja',
	portuguese: 'pt-PT',
	polish: 'pl',
	danish: 'da',
	dutch: 'nl',
	finnish: 'fi',
	norwegian: 'no',
	swedish: 'sv',
	hungarian: 'hu',
	czech: 'cs',
	romanian: 'ro',
	turkish: 'tr',
	brazilian: 'pt-BR',
	bulgarian: 'bg',
	greek: 'el',
	ukrainian: 'uk',
	latam: 'es-419',
	vietnamese: 'vi',
	arabic: 'ar'
};

let cachedLocale: string;
let relativeFormat: Intl.RelativeTimeFormat;
let dateFormat: Intl.DateTimeFormat;

function getLocale(): string {
	if (!cachedLocale) {
		const language = $.Language()?.toLowerCase();
		cachedLocale = SOURCE_LANGUAGE_TO_LOCALE[language] ?? 'en';
	}
	return cachedLocale;
}

const TIME_AGO_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 31557600],
	['month', 2629800],
	['day', 86400],
	['hour', 3600],
	['minute', 60],
	['second', 1]
];

const TIME_AGO_DEFAULT_OPTIONS: Intl.RelativeTimeFormatOptions = {
	numeric: 'always',
	style: 'long'
};

const DATE_DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
};

/**
 * Localized relative time, e.g. "3 days ago", from a unix timestamp in seconds.
 */
export function formatTimeAgoString(
	timestampSeconds: number,
	formatOptions: Intl.RelativeTimeFormatOptions = TIME_AGO_DEFAULT_OPTIONS
) {
	relativeFormat ??= new Intl.RelativeTimeFormat(getLocale(), formatOptions);

	const diff = timestampSeconds - Math.floor(Date.now() / 1000); // Negative when in the past
	for (const [unit, seconds] of TIME_AGO_UNITS) {
		if (Math.abs(diff) >= seconds) return relativeFormat.format(Math.trunc(diff / seconds), unit);
	}
	return relativeFormat.format(-0, 'second'); // -0 so it reads "0 seconds ago" rather than "in 0 seconds"
}

/**
 * Localized, human-readable duration rounded to the largest sensible unit, e.g. "2 days" or "35 minutes", from seconds.
 *
 * For approximate, prose-style durations (bans, cooldowns). For precise run times shown as a clock, use
 * {@link formatDurationDigital}.
 */
export function formatDuration(seconds: number): string {
	const minutes = Math.round(seconds / 60);
	const hours = Math.round(minutes / 60);
	const days = Math.round(hours / 24);

	const [value, unit] = minutes < 60 ? [minutes, 'minute'] : hours < 24 ? [hours, 'hour'] : [days, 'day'];

	return new Intl.NumberFormat(getLocale(), { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}

/**
 * Formats a duration in seconds as a digital clock string (`h:mm:ss.fff`), truncating (never rounding) to the given
 * number of fractional digits. Leading zero units are omitted, so short times read as `5.123` and `1:05.123`.
 *
 * For precise run times, splits and comparison diffs. Not localized. For an approximate, human-readable duration
 * like "35 minutes", use {@link formatDuration}.
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
 * @param fractionalDigits Number of digits shown after the decimal point, 0 (none) to 9 (nanoseconds).
 * @param includeSign If true, prefix `+` for positive and `-` for negative values. The sign is taken from the raw
 * value, before truncation, so a tiny non-zero value still gets a sign. Exactly 0 never gets one.
 * @returns The formatted duration string.
 */
export function formatDurationDigital(rawSeconds: number, fractionalDigits: number, includeSign = false): string {
	/**
	 * TODO: This code doesn't fix the underlying issue that exists in the engine timer code.
	 * Rework this after the engine issue gets fixed
	 */

	const sign = includeSign ? (rawSeconds > 0 ? '+' : rawSeconds < 0 ? '-' : '') : '';

	// Doubles can't store most decimal times exactly (1.005 is stored as 1.00499999999999989...)
	// Truncating the float directly can lose a whole digit. Snap to the nearest whole nanosecond first to absorb that error
	const totalNanos = Math.round(Math.abs(rawSeconds) * 1e9);
	const units = Math.trunc(totalNanos / 10 ** (9 - fractionalDigits));

	const scale = 10 ** fractionalDigits;
	const frac = units % scale;
	const wholeSeconds = Math.trunc(units / scale);
	const seconds = wholeSeconds % 60;
	const minutes = Math.trunc(wholeSeconds / 60) % 60;
	const hours = Math.trunc(wholeSeconds / 3600);

	const fraction = fractionalDigits > 0 ? `.${padNumber(frac, fractionalDigits)}` : '';

	if (hours > 0) return `${sign}${hours}:${padNumber(minutes, 2)}:${padNumber(seconds, 2)}${fraction}`;
	if (minutes > 0) return `${sign}${minutes}:${padNumber(seconds, 2)}${fraction}`;
	return `${sign}${seconds}${fraction}`;
}

/** Left-pads an integer with zeros to the given width, e.g. `padNumber(5, 2)` is "05". */
function padNumber(value: number, width: number): string {
	return value.toString().padStart(width, '0');
}

/**
 * Localized numeric calendar date, e.g. "11/23/2026" in English, from an ISO string, millisecond timestamp or Date.
 */
export function formatDate(
	date: string | number | Date,
	formatOptions: Intl.DateTimeFormatOptions = DATE_DEFAULT_OPTIONS
): string {
	dateFormat ??= new Intl.DateTimeFormat(getLocale(), formatOptions);
	return dateFormat.format(new Date(date));
}
