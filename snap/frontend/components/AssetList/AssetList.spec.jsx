import AssetList from '.';
import testHelper from '../testHelper';
import { screen } from '@testing-library/react';

const context = {
	dispatch: jest.fn(),
	walletState: {
		mosaics: []
	}
};

describe('components/AssetList', () => {
	const assertMosaic = (context, name, amountWithSubNamespace ) => {
		// Arrange:
		testHelper.customRender(<AssetList />, context);

		// Act:
		const mosaicImageElement = screen.getByRole(`mosaic-image_${0}`);
		const mosaicNameElement = screen.getByText(name);
		const mosaicAmountElement = screen.getByText(amountWithSubNamespace);

		// Assert:
		expect(mosaicImageElement).toBeInTheDocument();
		expect(mosaicNameElement).toBeInTheDocument();
		expect(mosaicAmountElement).toBeInTheDocument();
	};

	it('renders mosaic id when name is undefined', () => {
		// Arrange:
		context.walletState.mosaics = [
			{
				id: '3C596F764B5A1160',
				name: null,
				amount: 2
			}
		];

		assertMosaic(context, '3C596F764B5A1160', '2');
	});

	it('renders mosaic name when name is defined', () => {
		// Arrange:
		context.walletState.mosaics = [
			{
				id: 'E74B99BA41F4AFEE',
				name: 'symbol.xym',
				amount: 10.023123
			}
		];

		assertMosaic(context, 'symbol', '10.023123 xym');
	});

	it('renders multilevel mosaic name', () => {
		// Arrange:
		context.walletState.mosaics = [
			{
				id: '393AFB0B19902759',
				name: 'a.b.c',
				amount: 0.000001
			}
		];

		assertMosaic(context, 'a', '0.000001 b.c');
	});

	it('renders mosaic name without sub namespace', () => {
		// Arrange:
		context.walletState.mosaics = [
			{
				id: 'E74B99BA41F4AFEE',
				name: 'root',
				amount: 10
			}
		];

		assertMosaic(context, 'root', '10');
	});

	it('does not render when mosaics is empty', () => {
		// Arrange + Act:
		testHelper.customRender(<AssetList />, context);

		// Assert:
		const assetElement = screen.queryByRole('asset_0');
		expect(assetElement).not.toBeInTheDocument();
	});
});
