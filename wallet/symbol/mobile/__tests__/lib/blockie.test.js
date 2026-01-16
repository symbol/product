import { generateBlockie } from '@/app/lib/blockie';
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
	});
});
