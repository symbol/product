import { TRANSACTION_GROUP } from '@/app/constants';

// Transaction groups exposed by Symbol REST (route segments and transaction statuses).
export const SYMBOL_TRANSACTION_GROUP = {
	CONFIRMED: TRANSACTION_GROUP.CONFIRMED,
	UNCONFIRMED: TRANSACTION_GROUP.UNCONFIRMED,
	PARTIAL: 'partial'
};
