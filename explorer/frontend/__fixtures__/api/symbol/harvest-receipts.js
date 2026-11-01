// Contract-based fixtures, not captured from a live API. Amounts are already relative XYM.
export const harvestReceiptsResponse = [
	{
		version: 1, height: 1234, type: 'harvestFee', group: 'balanceChange',
		targetAddress: 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', sender: null, to: null, artifactId: null,
		mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 1.234567, isNative: true }]
	},
	{
		version: 1, height: 1234, type: 'harvestFee', group: 'balanceChange',
		targetAddress: 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', sender: null, to: null, artifactId: null,
		mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 0.000001, isNative: true }]
	},
	{
		version: 1, height: 1200, type: 'harvestFee', group: 'balanceChange',
		targetAddress: 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY', sender: null, to: null, artifactId: null,
		mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 0, isNative: true }]
	}
];

// Only the block-detail fields relevant to this adapter are listed.
export const harvestBlockResponses = [
	{ height: 1234, timestamp: '2026-10-20 01:02:03', totalFee: 999, beneficiaryAddress: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI' },
	{ height: 1200, timestamp: '2026-10-19 04:05:06', totalFee: 123, beneficiaryAddress: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI' }
];
