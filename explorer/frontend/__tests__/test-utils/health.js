export const healthSyncErrorResponse = {
	isOk: false,
	errors: [
		{
			type: 'synchronization',
			message: 'Node is no responding',
			details: {
				lastSyncedAt: '2025-05-07 14:17:11',
				lastBlockHeight: 456545654
			}
		}
	]
};
