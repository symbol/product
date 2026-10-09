import { transferUnconfirmedTransaction } from './transaction';

// eslint-disable-next-line no-unused-vars
const withoutAccountStateChange = ({ accountStateChange, ...transaction }) => transaction;

export const transactionListUnconfirmed = [transferUnconfirmedTransaction].map(withoutAccountStateChange);
