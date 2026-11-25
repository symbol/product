import { TRANSACTION_GROUP } from '@/app/constants';

export const SYMBOL_TRANSACTION_GROUP = {
	CONFIRMED: TRANSACTION_GROUP.CONFIRMED,
	UNCONFIRMED: TRANSACTION_GROUP.UNCONFIRMED,
	PARTIAL: 'partial'
};

export const SYMBOL_MESSAGE_TYPE = {
	PLAIN: 'plain',
	ENCRYPTED: 'encrypted',
	DELEGATED_HARVESTING: 'persistentDelegationHarvesting',
	RAW: 'raw'
};
