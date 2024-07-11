import AssetList from '.';
import testHelper from '../testHelper';
import { screen } from '@testing-library/react';

const context = {
	dispatch: jest.fn(),
	walletState: {
		selectedAccount: {
			...testHelper.generateAccountsState(1)['accountId 0']
		},
		mosaicInfo: {
			'3C596F764B5A1160': {
				name: [],
				divisibility: 0
			},
			'E74B99BA41F4AFEE': {
				name: ['symbol.xym'],
				divisibility: 6
			},
			'393AFB0B19902759': {
				name: ['a.b.c'],
				divisibility: 6
			},
			'0005EC25E3F9072D': {
				name: ['root'],
				divisibility: 0
			}
		}
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

	const assertLoading = context => {
		// Act:
		testHelper.customRender(<AssetList />, context);

		// Assert:
		const loadingElement = screen.getByText('Loading...');
		expect(loadingElement).toBeInTheDocument();
	};

	it('renders mosaic id when name is undefined', () => {
		// Arrange:
		context.walletState.selectedAccount.mosaics = [
			{
				id: '3C596F764B5A1160',
				amount: 2
			}
		];

		assertMosaic(context, '3C596F764B5A1160', '2');
	});

	it('renders mosaic name when name is defined', () => {
		// Arrange:
		context.walletState.selectedAccount.mosaics = [
			{
				id: 'E74B99BA41F4AFEE',
				amount: 10023123
			}
		];

		assertMosaic(context, 'symbol', '10.023123 xym');
	});

	it('renders multilevel mosaic name', () => {
		// Arrange:
		context.walletState.selectedAccount.mosaics = [
			{
				id: '393AFB0B19902759',
				amount: 1
			}
		];

		assertMosaic(context, 'a', '0.000001 b.c');
	});

	it('renders mosaic name without sub namespace', () => {
		// Arrange:
		context.walletState.selectedAccount.mosaics = [
			{
				id: '0005EC25E3F9072D',
				name: 'root',
				amount: 10
			}
		];

		assertMosaic(context, 'root', '10');
	});

	it('renders loading when mosaicInfo and selectedAccount is not loaded', () => {
		// Arrange:
		context.walletState.mosaicInfo = {};
		context.walletState.selectedAccount = {};

		assertLoading(context);
	});

	it('renders loading when selected account mosaics is not loaded', () => {
		// Arrange:
		context.walletState.selectedAccount = {};

		assertLoading(context);
	});


	it('does not render when mosaics is empty', () => {
		// Arrange + Act:
		testHelper.customRender(<AssetList />, context);

		// Assert:
		const assetElement = screen.queryByRole('asset_0');
		expect(assetElement).not.toBeInTheDocument();
	});
});
