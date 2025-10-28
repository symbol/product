import { LocalizationModule } from '../../src/lib/modules/LocalizationModule';
import { createStorageMock } from '../test-utils/storage';
import { jest } from '@jest/globals';

describe('LocalizationModule', () => {
	let persistentStorageInterface;
	let localizationModule;
	let onStateChange;

	beforeEach(() => {
		persistentStorageInterface = createStorageMock({});
		onStateChange = jest.fn();

		localizationModule = new LocalizationModule();
		localizationModule.init({
			persistentStorageInterface,
			onStateChange
		});
		localizationModule._persistentStorageRepository.getSelectedLanguage = jest.fn();
		localizationModule._persistentStorageRepository.setSelectedLanguage = jest.fn();
	});

	it('has correct static name', () => {
		// Assert:
		expect(LocalizationModule.name).toBe('localization');
	});

	describe('initial state', () => {
		it('starts with default language code "en"', () => {
			// Assert:
			expect(localizationModule.currentLanguage).toBe('en');
		});
	});

	describe('loadCache()', () => {
		it('loads language from persistent storage', async () => {
			// Arrange:
			localizationModule._persistentStorageRepository.getSelectedLanguage.mockResolvedValue('es');

			// Act:
			await localizationModule.loadCache();

			// Assert:
			expect(localizationModule._persistentStorageRepository.getSelectedLanguage).toHaveBeenCalled();
			expect(localizationModule.currentLanguage).toBe('es');
			expect(onStateChange).toHaveBeenCalled();
		});

		it('uses default language when stored language is null', async () => {
			// Arrange:
			localizationModule._persistentStorageRepository.getSelectedLanguage.mockResolvedValue(null);

			// Act:
			await localizationModule.loadCache();

			// Assert:
			expect(localizationModule.currentLanguage).toBe('en');
		});
	});

	describe('clear()', () => {
		it('resets state to default', async () => {
			// Arrange:
			localizationModule._persistentStorageRepository.getSelectedLanguage.mockResolvedValue('fr');
			await localizationModule.loadCache();
			expect(localizationModule.currentLanguage).toBe('fr');

			// Act:
			localizationModule.clear();

			// Assert:
			expect(localizationModule.currentLanguage).toBe('en');
		});
	});

	describe('selectLanguage()', () => {
		it('updates selected language and persists it', async () => {
			// Arrange:
			localizationModule._persistentStorageRepository.setSelectedLanguage.mockResolvedValue(undefined);

			// Act:
			await localizationModule.selectLanguage('de');

			// Assert:
			expect(localizationModule.currentLanguage).toBe('de');
			expect(localizationModule._persistentStorageRepository.setSelectedLanguage).toHaveBeenCalledWith('de');
			expect(onStateChange).toHaveBeenCalled();
		});
	});

	describe('resetState()', () => {
		it('resets state to default values', async () => {
			// Arrange:
			await localizationModule.selectLanguage('ja');
			expect(localizationModule.currentLanguage).toBe('ja');

			// Act:
			localizationModule.resetState();

			// Assert:
			expect(localizationModule.currentLanguage).toBe('en');
		});
	});
});
