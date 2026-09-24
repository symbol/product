import fs from 'fs';
import path from 'path';

// Enforces docs/localization.md on the source locale.

// File locations

const LOCALE_FILE_PATH = path.join(__dirname, '../../src/localization/locales/en.json');
const SCREENS_DIRECTORY = path.join(__dirname, '../../src/screens');
const COMPONENT_DIRECTORIES = [path.join(__dirname, '../../src/components'), path.join(__dirname, '../../src/app/components')];

// Element vocabulary (guideline "Elements")

const ELEMENT_WORDS = [
	'dialog', 'alert', 'status', 'item', 'tab', 'step', 'button', 'link', 'checkbox', 'toggle', 'chip', 'widget',
	'inputLabel', 'fieldTitle', 'fieldValue', 'errorMessage', 'validationError',
	'title', 'subtitle', 'description', 'label', 'placeholder', 'hint', 'tooltip', 'message'
];
const GLOBAL_ONLY_ELEMENT_WORDS = [
	'transactionType', 'transactionDescriptionShort', 'transactionGroup', 'transactionStatus',
	'receiptType', 'month', 'feeSpeed', 'screenTitle'
];
const GLOBAL_ELEMENT_WORDS = [...ELEMENT_WORDS, ...GLOBAL_ONLY_ELEMENT_WORDS];

const SEGMENT_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const SECTION_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

// Key owners taken from the filesystem

const toCamelCase = kebabName => kebabName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

// Screen folders under src/screens ("address-book" -> "addressBook").
const screenFolders = fs.readdirSync(SCREENS_DIRECTORY, { withFileTypes: true })
	.filter(entry => entry.isDirectory())
	.map(entry => toCamelCase(entry.name));

const collectComponentFileNames = directory =>
	fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
		if (entry.isDirectory()) 
			return [entry.name, ...collectComponentFileNames(path.join(directory, entry.name))];

		return entry.name.endsWith('.jsx') ? [path.basename(entry.name, '.jsx')] : [];
	});

// PascalCase component files and folders ("TransactionScreenTemplate" -> "transactionScreenTemplate").
const componentNames = COMPONENT_DIRECTORIES.flatMap(collectComponentFileNames)
	.filter(name => /^[A-Z]/.test(name))
	.map(name => name[0].toLowerCase() + name.slice(1));

// Key grammar (guideline "Scopes", "Folder and section", "Chaining")

// Chain grammar: <element>_<name>[_<element>[_<name>]].
const getChainViolation = (chainSegments, firstElementWords) => {
	const [element, , subElement] = chainSegments;

	if (chainSegments.length < 2 || chainSegments.length > 4) 
		return 'chain must be <element>_<name>[_<element>[_<name>]]';
	if (!firstElementWords.includes(element)) 
		return `'${element}' is not an element word`;
	if (subElement !== undefined && !ELEMENT_WORDS.includes(subElement)) 
		return `'${subElement}' is not an element word`;

	return null;
};

// Scoped keys: screen_<folder>[_<section>]_<chain>, component_<componentName>[_<section>]_<chain>.
const getScopedKeyViolation = (segments, ownerNames, ownerLabel) => {
	const [, ownerName, ...rest] = segments;

	if (!ownerNames.includes(ownerName)) 
		return `unknown ${ownerLabel} '${ownerName}'`;

	const hasSection = rest.length > 0 && !ELEMENT_WORDS.includes(rest[0]);
	if (hasSection && !SECTION_PATTERN.test(rest[0])) 
		return `section '${rest[0]}' must be camelCase`;

	const chainViolation = getChainViolation(hasSection ? rest.slice(1) : rest, ELEMENT_WORDS);
	if (chainViolation && hasSection)
		return `'${rest[0]}' is not an element word, and as a section: ${chainViolation}`;

	return chainViolation;
};

// Returns the guideline violation for a key, or null when the key is valid.
const getKeyViolation = key => {
	const segments = key.split('_');

	if (segments.some(segment => !SEGMENT_PATTERN.test(segment))) 
		return 'segments must be letters and digits, starting with a letter';
	if (segments[0] === 'screen') 
		return getScopedKeyViolation(segments, screenFolders, 'screen folder');
	if (segments[0] === 'component') 
		return getScopedKeyViolation(segments, componentNames, 'component');

	return getChainViolation(segments, GLOBAL_ELEMENT_WORDS);
};

describe('localization/locales/en.json', () => {
	const rawText = fs.readFileSync(LOCALE_FILE_PATH, 'utf8');
	const en = JSON.parse(rawText);
	const keys = Object.keys(en);

	describe('file format', () => {
		it('is canonically formatted: 4-space indent, no duplicate keys, trailing newline', () => {
			// Act & Assert:
			expect(rawText).toBe(JSON.stringify(en, null, 4) + '\n');
		});

		it('keys are sorted alphabetically, case-insensitive', () => {
			// Arrange:
			const expectedKeys = [...keys].sort((keyA, keyB) => (keyA.toLowerCase() < keyB.toLowerCase() ? -1 : 1));

			// Act & Assert:
			expect(keys).toEqual(expectedKeys);
		});
	});

	describe('key structure', () => {
		it('every key follows the guideline grammar', () => {
			// Act:
			const violations = keys
				.map(key => ({ key, violation: getKeyViolation(key) }))
				.filter(entry => entry.violation !== null)
				.map(entry => `${entry.key} — ${entry.violation}`);

			// Assert:
			expect(violations).toEqual([]);
		});
	});
});
