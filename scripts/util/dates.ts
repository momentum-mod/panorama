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

/**
 * Localized relative time, e.g. "3 days ago", from a unix timestamp in seconds.
 */
export function getTimeAgoString(timestampSeconds: number): string {
	relativeFormat ??= new Intl.RelativeTimeFormat(getLocale(), { numeric: 'always', style: 'long' });

	const diff = timestampSeconds - Math.floor(Date.now() / 1000); // Negative when in the past
	for (const [unit, seconds] of TIME_AGO_UNITS) {
		if (Math.abs(diff) >= seconds) return relativeFormat.format(Math.trunc(diff / seconds), unit);
	}
	return relativeFormat.format(-0, 'second'); // -0 so it reads "0 seconds ago" rather than "in 0 seconds"
}

/**
 * Localized duration rounded to the largest sensible unit, e.g. "2 days" or "35 minutes", from seconds.
 */
export function formatDuration(seconds: number): string {
	const minutes = Math.round(seconds / 60);
	const hours = Math.round(minutes / 60);
	const days = Math.round(hours / 24);

	const [value, unit] = minutes < 60 ? [minutes, 'minute'] : hours < 24 ? [hours, 'hour'] : [days, 'day'];

	return new Intl.NumberFormat(getLocale(), { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}

/**
 * Localized numeric calendar date, e.g. "11/23/2026" in English, from an ISO string, millisecond timestamp or Date.
 */
export function formatDate(date: string | number | Date): string {
	dateFormat ??= new Intl.DateTimeFormat(getLocale(), { year: 'numeric', month: '2-digit', day: '2-digit' });
	return dateFormat.format(new Date(date));
}
