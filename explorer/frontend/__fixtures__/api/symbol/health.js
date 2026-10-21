export const healthWithSyncErrorResponse = {
	backendSynced: false,
	dbUp: true,
	errors: [
		{
			message: 'Symbol database height 3778898 does not match chain height 3778918',
			type: 'synchronization'
		}
	],
	finalizedHeight: 3778877,
	isHealthy: false,
	lastDBHeight: 3778898,
	lastDBSyncedAt: '2026-10-06 12:46:20',
	status: 'healthy'
};
