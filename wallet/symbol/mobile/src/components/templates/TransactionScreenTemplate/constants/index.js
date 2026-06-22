export const TransactionStatusStep = {
	CREATE: 'create',
	SIGN: 'sign',
	ANNOUNCE: 'announce',
	CONFIRM: 'confirm'
};

export const TransactionWorkflowStatus = {
	IDLE: 'idle',
	CREATING: 'creating',
	CREATE_ERROR: 'create_error',
	CREATED: 'created',
	SIGNING: 'signing',
	SIGN_ERROR: 'sign_error',
	SIGNED: 'signed',
	ANNOUNCING: 'announcing',
	ANNOUNCE_ERROR: 'announce_error',
	ANNOUNCED: 'announced',
	CONFIRMED: 'confirmed',
	FAILED_TRANSACTIONS: 'failed_transactions',
	PARTIAL: 'partial'
};
