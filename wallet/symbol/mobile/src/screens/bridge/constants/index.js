export const BRIDGE_HISTORY_PAGE_SIZE = 5;

export const BridgeTransactionWorkflowStatus = {
	IDLE: 'idle',
	CREATING: 'creating',
	CREATE_ERROR: 'create_error',
	CREATED: 'created',
	
	SIGNING_1: 'signing_1',
	SIGN_ERROR_1: 'sign_error_1',
	SIGNED_1: 'signed_1',

	SIGNING_2: 'signing_2',
	SIGN_ERROR_2: 'sign_error_2',
	SIGNED_2: 'signed_2',

	ANNOUNCING_1: 'announcing_1',
	ANNOUNCE_ERROR_1: 'announce_error_1',
	ANNOUNCED_1: 'announced_1',

	CONFIRMED_1: 'confirmed_1',
	FAILED_1: 'failed_1',

	ANNOUNCING_2: 'announcing_2',
	ANNOUNCE_ERROR_2: 'announce_error_2',
	ANNOUNCED_2: 'announced_2',

	CONFIRMED_2: 'confirmed_2',
	FAILED_2: 'failed_2'
};
