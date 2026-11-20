import account from './account.json';
import blocks from './blocks.json';
import home from './home.json';
import { SYMBOL_TRANSACTION_TYPE } from '../../constants';

const pages = {
	account,
	blocks,
	home,
	transactions: {
		transactionTypes: Object.values(SYMBOL_TRANSACTION_TYPE)
	}
};

export default pages;
