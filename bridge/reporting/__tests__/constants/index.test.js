import { BRIDGE_TABS } from '@/constants';

describe('report tab configuration', () => {
	it('contains the supported request and error tabs', () => {
		// Arrange:
		const xym = { ticker: 'XYM', divisibility: 6 };
		const bxym = { ticker: 'bXYM', divisibility: 6 };
		const eth = { ticker: 'ETH', divisibility: 18 };
		const expectedTabs = [
			{
				id: 'xym-bxym-requests',
				label: 'XYM → bXYM',
				bridgeType: 'wrapped',
				operation: 'wrap',
				sourceAsset: xym,
				destinationAsset: bxym,
				sourceNetwork: 'nativeNetwork',
				destinationNetwork: 'wrappedNetwork',
				resource: 'requests'
			},
			{
				id: 'bxym-xym-requests',
				label: 'bXYM → XYM',
				bridgeType: 'wrapped',
				operation: 'unwrap',
				sourceAsset: bxym,
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
				id: 'xym-bxym-errors',
				label: 'XYM → bXYM Errors',
				bridgeType: 'wrapped',
				operation: 'wrap',
				sourceAsset: xym,
				destinationAsset: bxym,
				sourceNetwork: 'nativeNetwork',
				destinationNetwork: 'wrappedNetwork',
				resource: 'errors'
			},
			{
				id: 'bxym-xym-errors',
				label: 'bXYM → XYM Errors',
				bridgeType: 'wrapped',
				operation: 'unwrap',
				sourceAsset: bxym,
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
