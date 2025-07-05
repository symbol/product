import { validateFields } from '../utils/helper';

const requiredMethods = [
	'fetchAccountInfo',
	'fetchNetworkProperties',
	'fetchAccountTransactions',
	'pingNode',
	'fetchNetworkProperties',
	'fetchNodeList'
];

/**
 * @description This class provides protocol-related API functionality using injected methods.
 */
export class ProtocolApi {
	fetchAccountInfo;
	fetchNetworkProperties;
	fetchAccountTransactions;
	pingNode;
	fetchNetworkProperties;
	fetchNodeList;

	constructor(methods) {
		validateFields(methods, requiredMethods.map(method => ({ key: method, type: 'function' })));
		const _this = this;
		requiredMethods.forEach(method => {
			_this[method] = methods[method];
		});
	}
}
