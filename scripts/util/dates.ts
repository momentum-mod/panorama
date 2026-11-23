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
	relativeFormat ??= new Intl.RelativeTimeFormat(getLocale(), { numeric: 'auto', style: 'long' });

	const diff = timestampSeconds - Math.floor(Date.now() / 1000); // Negative when in the past
	for (const [unit, seconds] of TIME_AGO_UNITS) {
		if (Math.abs(diff) >= seconds) return relativeFormat.format(Math.trunc(diff / seconds), unit);
	}
	return relativeFormat.format(0, 'second');
}
