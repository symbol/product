// Symbol variant — transactions API (returns static stub fixtures, no data layer / node calls yet).
import { stubTransactions } from './fixtures';
import { stubPage, stubValue } from './stub';

export const fetchTransactionPage = stubPage(stubTransactions);
export const fetchTransactionInfo = stubValue(stubTransactions[0]);
