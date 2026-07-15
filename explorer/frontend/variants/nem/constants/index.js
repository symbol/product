import { TRANSACTION_GROUP } from '@/app/constants';

// NIS transfer message type codes.
export const NEM_MESSAGE_TYPE = {
	PLAIN: 1,
	ENCRYPTED: 2
};

// Transaction groups the NEM data layer stamps on mapped transactions.
export const NEM_TRANSACTION_GROUP = {
	CONFIRMED: TRANSACTION_GROUP.CONFIRMED,
	UNCONFIRMED: TRANSACTION_GROUP.UNCONFIRMED
};
