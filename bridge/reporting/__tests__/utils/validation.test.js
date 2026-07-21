import { parseSearchInput } from '@/utils/validation';

describe('parseSearchInput', () => {
	it('parse a Symbol address', () => {
		// Arrange:
		const address = 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY';

		// Act:
		const parsedSearch = parseSearchInput(address.toLowerCase());

		// Assert:
		expect(parsedSearch).toEqual({ type: 'address', value: address });
	});

	it('parse an Ethereum address', () => {
		// Arrange:
		const address = '0x0f02eE65e510eA30006e63aAcC668428aD7A998E';

		// Act:
		const parsedSearch = parseSearchInput(address);

		// Assert:
		expect(parsedSearch).toEqual({ type: 'address', value: address });
	});

	it('strips the Ethereum prefix from a transaction hash', () => {
		// Arrange:
		const hash = 'a'.repeat(64);

		// Act:
		const parsedSearch = parseSearchInput(`0x${hash}`);

		// Assert:
		expect(parsedSearch).toEqual({ type: 'hash', value: hash.toUpperCase() });
	});

	it('accepts an empty filter and rejects invalid text', () => {
		// Arrange:
		const emptySearch = '';
		const invalidSearch = 'not an address';

		// Act:
		const emptyResult = parseSearchInput(emptySearch);
		const invalidResult = parseSearchInput(invalidSearch);

		// Assert:
		expect(emptyResult).toEqual({ type: null, value: '' });
		expect(invalidResult).toBeNull();
	});
});
