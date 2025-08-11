import { PersistentStorageRepository } from '../storage/PersistentStorageRepository';

const DEFAULT_LANGUAGE_CODE = 'en';

const createDefaultState = () => ({
	selectedLanguageCode: DEFAULT_LANGUAGE_CODE
});

export class LocalizationModule {
	static name = 'localization';

	_persistentStorageRepository;
	#onStateChange;

	constructor() {}

	init = options => {
		this._state = createDefaultState();
		this._persistentStorageRepository = new PersistentStorageRepository(options.persistentStorageInterface);
		this.#onStateChange = options.onStateChange;
	};

	/**
	 * Returns the current language code.
	 * @returns {string} The current language code.
	 */
	get currentLanguage() {
		return this._state.selectedLanguageCode;
	}

	/**
	 * Loads the selected language from persistent storage.
	 * @returns {Promise<void>} A promise that resolves when the language is loaded.
	 */
	loadCache = async () => {
		const languageCode = await this._persistentStorageRepository.getSelectedLanguage();

		this.resetState();

		this.#setState(() => {
			this._state.selectedLanguageCode = languageCode || DEFAULT_LANGUAGE_CODE;
		});
	};

	/**
	 * Clears the module state.
	 */
	resetState = () => {
		this._state = createDefaultState();
	};

	clear = () => {
		this.resetState();
	};

	#setState = callback => {
		callback.bind(this);
		callback();

		this.#onStateChange?.();
	};

	/**
	 * Selects the user language.
	 * @param {string} languageCode - The user language.
	 */
	selectLanguage = async languageCode => {
		await this._persistentStorageRepository.setSelectedLanguage(languageCode);

		this.#setState(() => {
			this._state.selectedLanguageCode = languageCode;
		});
	};
}
