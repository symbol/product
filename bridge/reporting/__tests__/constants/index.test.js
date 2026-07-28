import { BRIDGE_TABS } from '@/constants';

describe('report tab configuration', () => {
	it('contains the supported request and error tabs', () => {
		// Arrange:
		const xym = { ticker: 'XYM', divisibility: 6 };
		const wxym = { ticker: 'WXYM', divisibility: 6 };
		const eth = { ticker: 'ETH', divisibility: 18 };
		const expectedTabs = [
			{
				id: 'xym-wxym-requests',
				label: 'XYM → WXYM',
				bridgeType: 'wrapped',
				operation: 'wrap',
				sourceAsset: xym,
				destinationAsset: wxym,
				sourceNetwork: 'nativeNetwork',
				destinationNetwork: 'wrappedNetwork',
				resource: 'requests'
			},
			{
				id: 'wxym-xym-requests',
				label: 'WXYM → XYM',
				bridgeType: 'wrapped',
				operation: 'unwrap',
				sourceAsset: wxym,
				destinationAsset: xym,
				sourceNetwork: 'wrappedNetwork',
				destinationNetwork: 'nativeNetwork',
				resource: 'requests'
			},
			{
				id: 'xym-eth-requests',
				label: 'XYM → ETH',
				bridgeType: 'native',
				operation: 'wrap',
				sourceAsset: xym,
				destinationAsset: eth,
				sourceNetwork: 'nativeNetwork',
				destinationNetwork: 'wrappedNetwork',
				resource: 'requests'
			},
			{
				id: 'xym-wxym-errors',
				label: 'XYM → WXYM Errors',
				bridgeType: 'wrapped',
				operation: 'wrap',
				sourceAsset: xym,
				destinationAsset: wxym,
				sourceNetwork: 'nativeNetwork',
				destinationNetwork: 'wrappedNetwork',
				resource: 'errors'
			},
			{
				id: 'wxym-xym-errors',
				label: 'WXYM → XYM Errors',
				bridgeType: 'wrapped',
				operation: 'unwrap',
				sourceAsset: wxym,
				destinationAsset: xym,
				sourceNetwork: 'wrappedNetwork',
				destinationNetwork: 'nativeNetwork',
				resource: 'errors'
			},
			{
				id: 'xym-eth-errors',
				label: 'XYM → ETH Errors',
				bridgeType: 'native',
				operation: 'wrap',
				sourceAsset: xym,
				destinationAsset: eth,
				sourceNetwork: 'nativeNetwork',
				destinationNetwork: 'wrappedNetwork',
				resource: 'errors'
			}
		];

		// Act:
		const tabs = BRIDGE_TABS;

		// Assert:
		expect(tabs).toEqual(expectedTabs);
	});
});
