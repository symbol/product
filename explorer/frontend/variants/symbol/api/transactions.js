// Symbol variant — transactions API (returns static stub fixtures, no data layer / node calls yet).
import { stubTransactions } from './fixtures';
import { stubPage, stubValue } from './stub';
import { SYMBOL_MESSAGE_TYPE } from '../constants';
import { TRANSACTION_TYPE } from '../transaction/transaction-types';

const SUPPLY_CHANGE_ACTION = {
	INCREASE: 'increase',
	DECREASE: 'decrease'
};

const formatTransferMessage = message => {
	if (!message)
		return null;

	return {
		type: message.type ?? SYMBOL_MESSAGE_TYPE.RAW,
		text: message.text
	};
};

const bodyItemFromDTO = ({ type, sender, recipient, detail }) => {
	const bodyItem = {
		type,
		sender,
		recipient,
		...detail
	};

	switch (type) {
	case TRANSACTION_TYPE.TRANSFER:
		return {
			...bodyItem,
			message: formatTransferMessage(bodyItem.message)
		};
	case TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE: {
		const { action, delta, ...supplyChange } = bodyItem;
		const isDecrease = action === SUPPLY_CHANGE_ACTION.DECREASE;

		return {
			...supplyChange,
			delta: isDecrease ? -Number(delta) : Number(delta)
		};
	}
	default:
		return bodyItem;
	}
};

/**
 * Maps the transaction details DTO to the body items shown on the transaction info page.
 * @param {object} data - Transaction details DTO.
 * @returns {object[]} Body items, one for the transaction or one for each embedded transaction.
 */
export const transactionBodyFromDTO = data => data.graphic.transactions.map(bodyItemFromDTO);

export const fetchTransactionPage = stubPage(stubTransactions);
export const fetchTransactionInfo = stubValue(stubTransactions[0]);
