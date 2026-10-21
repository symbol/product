export const healthWithSyncErrorResponse = {
	backendSynced: false,
	errors: [
		{
			message: 'Database is 120 blocks behind node height',
			type: 'synchronization'
		}
	],
	isHealthy: false,
	lastDBHeight: 822797,
	lastDBSyncedAt: '2026-10-07 22:50:04',
	nodeHeight: 822917,
	nodeUp: true
};
