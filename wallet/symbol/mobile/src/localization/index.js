import { walletControllers } from '@/app/lib/controller';
import { I18n } from 'i18n-js';
import { memoize } from 'lodash';

// Configuration

const DEFAULT_LANGUAGE_CODE = 'en';

const translationGetters = {
	cn: () => require('./locales/cn.json'),
	en: () => require('./locales/en.json'),
	ja: () => require('./locales/ja.json'),
	ko: () => require('./locales/ko.json'),
	uk: () => require('./locales/uk.json'),
	zh: () => require('./locales/zh.json')
	// Require new languages here
};

const languageNames = {
	cn: '汉语',
	en: 'English',
	ja: '日本語',
	ko: '한국어',
	uk: 'Українська',
	zh: '漢語'
	// Add names for new languages here
};

// Logic 

const mainWalletController = walletControllers.main;
const i18n = new I18n();

const translate = memoize(
	(key, config) => i18n.t(key, config),
	(key, config) => (config ? key + JSON.stringify(config) : key)
);

const updateConfig = languageCode => {
	let updatedLanguageCode = DEFAULT_LANGUAGE_CODE;

	if (languageCode && translationGetters.hasOwnProperty(languageCode)) 
		updatedLanguageCode = languageCode;
	

	translate.cache.clear();
	i18n.translations = {
		[updatedLanguageCode]: translationGetters[updatedLanguageCode](),
		[DEFAULT_LANGUAGE_CODE]: translationGetters[DEFAULT_LANGUAGE_CODE]()
	};
	i18n.defaultLocale = DEFAULT_LANGUAGE_CODE;
	i18n.locale = updatedLanguageCode;
	i18n.fallbacks = true;
};

export const initLocalization = () => {
	const languageCode = getCurrentLanguage();
	updateConfig(languageCode);
};

export const getCurrentLanguage = () => {
	return mainWalletController.modules.localization.currentLanguage;
};

export const setCurrentLanguage = async languageCode => {
	updateConfig(languageCode);
	await mainWalletController.modules.localization.selectLanguage(languageCode);
};

export const getLanguages = () => {
	return {
		...languageNames
	};
};

export const $t = translate;
