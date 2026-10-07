import {
	accountKeyLinkConfirmedTransactionResponse,
	multisigConfirmedTransactionResponse,
	transferConfirmedTransactionResponse
} from './transaction-info';

export const transactionListConfirmedResponse = [
	transferConfirmedTransactionResponse,
	accountKeyLinkConfirmedTransactionResponse,
	multisigConfirmedTransactionResponse
];
