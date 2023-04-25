import { loadHome } from './loadHome';

jest.mock('./nem/pages/Home', () => () => <div>NEM Home</div>);
jest.mock('./symbol/pages/Home', () => () => <div>Symbol Home</div>);

describe('loadHome', () => {
	it('returns NEM Home component when target is "nem"', async () => {
		// Act:
		const HomeComponent = await loadHome('nem');

		// Assert:
		expect(HomeComponent()).toEqual(<div>NEM Home</div>);
	});

	it('returns Symbol Home component when target is "symbol"', async () => {
		// Act:
		const HomeComponent = await loadHome('symbol');

		// Assert:
		expect(HomeComponent()).toEqual(<div>Symbol Home</div>);
	});

	it('throws an error when target is not specified', async () => {
		// Act + Assert:
		await expect(loadHome(undefined)).rejects.toThrowError('The build target is not specified');
	});
});
