export const PAGE_SIZE = 100;

const ASSETS = {
	XYM: { ticker: 'XYM', divisibility: 6 },
	WXYM: { ticker: 'WXYM', divisibility: 6 },
	ETH: { ticker: 'ETH', divisibility: 18 }
};

const createBridgeTabs = () => {
	const bridgeRoutes = [
		{
			id: 'xym-wxym',
			label: 'XYM → WXYM',
			bridgeType: 'wrapped',
			operation: 'wrap',
			sourceAsset: ASSETS.XYM,
			destinationAsset: ASSETS.WXYM,
			sourceNetwork: 'nativeNetwork',
			destinationNetwork: 'wrappedNetwork'
		},
		{
			id: 'wxym-xym',
			label: 'WXYM → XYM',
			bridgeType: 'wrapped',
			operation: 'unwrap',
			sourceAsset: ASSETS.WXYM,
			destinationAsset: ASSETS.XYM,
			sourceNetwork: 'wrappedNetwork',
			destinationNetwork: 'nativeNetwork'
		},
		{
			id: 'xym-eth',
			label: 'XYM → ETH',
			bridgeType: 'native',
			operation: 'wrap',
			sourceAsset: ASSETS.XYM,
			destinationAsset: ASSETS.ETH,
			sourceNetwork: 'nativeNetwork',
			destinationNetwork: 'wrappedNetwork'
		}
	];

	const createTab = (route, resource) => ({
		...route,
		id: `${route.id}-${resource}`,
		label: 'errors' === resource ? `${route.label} Errors` : route.label,
		resource
	});

	return [
		...bridgeRoutes.map(route => createTab(route, 'requests')),
		...bridgeRoutes.map(route => createTab(route, 'errors'))
	];
};

export const BRIDGE_TABS = createBridgeTabs();

export const PAYOUT_STATUS = {
	UNPROCESSED: 0,
	SENT: 1,
	COMPLETED: 2,
	FAILED: 3
};

export const PAYOUT_STATUS_OPTIONS = [
	{ label: 'All', value: null },
	{ label: 'Unprocessed', value: PAYOUT_STATUS.UNPROCESSED },
	{ label: 'Sent', value: PAYOUT_STATUS.SENT },
	{ label: 'Completed', value: PAYOUT_STATUS.COMPLETED },
	{ label: 'Failed', value: PAYOUT_STATUS.FAILED }
];

export const PAYOUT_STATUS_DETAILS = {
	[PAYOUT_STATUS.UNPROCESSED]: { label: 'Unprocessed', tone: 'neutral' },
	[PAYOUT_STATUS.SENT]: { label: 'Sent', tone: 'info' },
	[PAYOUT_STATUS.COMPLETED]: { label: 'Completed', tone: 'success' },
	[PAYOUT_STATUS.FAILED]: { label: 'Failed', tone: 'danger' }
};
