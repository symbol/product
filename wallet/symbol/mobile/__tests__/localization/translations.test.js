import fs from 'fs';
import path from 'path';

// Checks translation locale files for consistency with the source locale (en.json).

const LOCALES_DIRECTORY = path.join(__dirname, '../../src/localization/locales');

// The list of translated locale files that are tested for key consistency.
const TRANSLATED_LOCALE_FILES = [];

// Outdated translations; not tested.
const LEGACY_LOCALE_FILES = ['cn.json', 'ja.json', 'ko.json', 'uk.json', 'zh.json'];

const readLocaleKeys = fileName => Object.keys(JSON.parse(fs.readFileSync(path.join(LOCALES_DIRECTORY, fileName), 'utf8')));

const enKeys = readLocaleKeys('en.json');

describe('localization/locales translations', () => {
	it('locales directory contains only en.json and the registered locale files', () => {
		// Arrange:
		const expectedFileNames = ['en.json', ...TRANSLATED_LOCALE_FILES, ...LEGACY_LOCALE_FILES].sort();

		// Act:
		const fileNames = fs.readdirSync(LOCALES_DIRECTORY).sort();

		// Assert:
		expect(fileNames).toEqual(expectedFileNames);
	});

	const runTranslationFileTests = fileName => {
		describe(fileName, () => {
			const translationKeys = readLocaleKeys(fileName);

			it('has every key from en.json', () => {
			// Act:
				const missingKeys = enKeys.filter(key => !translationKeys.includes(key));

				// Assert:
				expect(missingKeys).toEqual([]);
			});

			it('has no keys that are absent from en.json', () => {
			// Act:
				const extraKeys = translationKeys.filter(key => !enKeys.includes(key));

				// Assert:
				expect(extraKeys).toEqual([]);
			});

			it('keys are in the same order as in en.json', () => {
			// Arrange:
				const expectedSharedKeys = enKeys.filter(key => translationKeys.includes(key));

				// Act:
				const sharedKeys = translationKeys.filter(key => enKeys.includes(key));

				// Assert:
				expect(sharedKeys).toEqual(expectedSharedKeys);
			});
		});
	};

	TRANSLATED_LOCALE_FILES.forEach(runTranslationFileTests);
});
