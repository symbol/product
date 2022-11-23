import en from './locales/en.json';

export class i18n {
	// Supported languages
	static languages = ['en'];

	static defaultLanguage = 'en';

	/**
     * Returns locale object depeding on the current language
     * @returns {string} locale object
     */
	static getCurrentLocale() {
		const currentLanguage = i18n.getCurrentLanguage();

		switch (currentLanguage) {
		default:
		case 'en':
			return en;
		}
	}

	/**
     * Returnsns all supported languages
     * @returns {string[]} list of languages
     */
	static getLanguages() {
		return i18n.languages;
	}

	/**
     * Returns user selected or default language
     * @returns {string} current language
     */
	static getCurrentLanguage() {
		const currentLanguage = localStorage.getItem('currentLanguage') || i18n.defaultLanguage;
		const supportedLanguages = i18n.getLanguages();

		if (!supportedLanguages.includes(currentLanguage)) {
			console.error(`Current language "${currentLanguage}" is not supported. Switching to default.`);

			return i18n.defaultLanguage;
		}
		return currentLanguage;
	}

	/**
     * Sets user language
     * @param {string} lang - language
     */
	static setCurrentLanguage(lang) {
		const supportedLanguages = i18n.getLanguages();

		if (supportedLanguages.includes(lang))
			localStorage.setItem('currentLanguage', lang);
		else
			console.error(`Failed to set current language. Language "${lang}"" is not supported`);
	}

	/**
     * Returns copy by key depeding on the current language
     * @param {string} key - translation key
	 * @param {Record<string, string>} variables - variables to inject into translated string
     * @returns {string} translated copy text
     */
	static getCopy(key, variables) {
		const locale = i18n.getCurrentLocale();
		const keyExists = locale.hasOwnProperty(key);

		if (keyExists) {
			let translatedString = `${locale[key]}`;
			variables && Object.keys(variables).forEach(variableName => {
				translatedString = translatedString.replace(new RegExp(`%${variableName}`, 'g'), variables[variableName]);
			});

			return translatedString;
		}
		const currentLanguage = i18n.getCurrentLanguage();

		return `[missing_translation](${currentLanguage})${key}`;
	}
}

export const $t = i18n.getCopy;
