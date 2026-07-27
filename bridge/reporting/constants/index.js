export const PAGE_SIZE = 100;

export const PAYOUT_STATUS = {
	UNPROCESSED: 0,
	SENT: 1,
	COMPLETED: 2,
	FAILED: 3
};

export const PAYOUT_STATUS_DETAILS = {
	[PAYOUT_STATUS.UNPROCESSED]: { label: 'Unprocessed', tone: 'neutral' },
	[PAYOUT_STATUS.SENT]: { label: 'Sent', tone: 'info' },
	[PAYOUT_STATUS.COMPLETED]: { label: 'Completed', tone: 'success' },
	[PAYOUT_STATUS.FAILED]: { label: 'Failed', tone: 'danger' }
};
