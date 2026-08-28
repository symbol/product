import { generateBlockie, getBlockieColors } from '@/app/lib/blockie';
import { blockies } from '__fixtures__/local/blockie';

describe('lib/blockie', () => {
	describe('generateBlockie', () => {
		const runBlockieTests = (address, expected) => {
			it(`generates blockie for "${address}"`, () => {
				// Act:
				const blockie = generateBlockie(address);

				// Assert:
				expect(blockie.background).toBe(expected.background);
				expect(blockie.foreground).toBe(expected.foreground);
				expect(blockie.spot).toBe(expected.spot);
				expect(blockie.image).toBe(expected.image);
			});
		};

		const tests = blockies.map(b => ({
			address: b.address,
			expected: b.blockie
		}));

		tests.forEach(test => runBlockieTests(test.address, test.expected));

		it('returns the cached object for repeated calls with the same address', () => {
			// Arrange:
			const { address } = blockies[0];

			// Act:
			const firstBlockie = generateBlockie(address);
			const secondBlockie = generateBlockie(address);
			const lowerCaseAddressBlockie = generateBlockie(address.toLowerCase());

			// Assert: the cache is keyed by the lowercased address
			expect(secondBlockie).toBe(firstBlockie);
			expect(lowerCaseAddressBlockie).toBe(firstBlockie);
		});
	});

	describe('getBlockieColors', () => {
		const runBlockieColorsTests = (address, expected) => {
			it(`generates colors matching the full blockie for "${address}"`, () => {
				// Act:
				const colors = getBlockieColors(address);

				// Assert:
				expect(colors).toStrictEqual({
					background: expected.background,
					foreground: expected.foreground,
					spot: expected.spot
				});
			});
		};

		const tests = blockies.map(b => ({
			address: b.address,
			expected: b.blockie
		}));

		tests.forEach(test => runBlockieColorsTests(test.address, test.expected));
	});
});
