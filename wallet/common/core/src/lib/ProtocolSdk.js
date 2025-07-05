import { validateFields } from '../utils/helper';

const requiredMethods = [
	'signTransaction',
	'cosignTransaction',
	'encryptMessage',
	'decryptMessage',
	'createPrivateAccount',
	'createPrivateKeysFromMnemonic'
];

/**
 * @description This class provides protocol-related wallet functionality using injected methods.
 */
export class ProtocolSdk {
	signTransaction;
	cosignTransaction;
	encryptMessage;
	decryptMessage;
	createPrivateAccount;
	createPrivateKeysFromMnemonic;

	constructor(methods) {
		validateFields(methods, requiredMethods.map(method => ({ key: method, type: 'function' })));
		const _this = this;
		requiredMethods.forEach(method => {
			_this[method] = methods[method];
		});
	}
}
