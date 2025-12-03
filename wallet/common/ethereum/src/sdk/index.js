import { SdkError } from 'wallet-common-core';

export { 
	signTransaction,
	signTransactionBundle,
	createPrivateAccount, 
	createPrivateKeysFromMnemonic 
} from '../utils';

export const cosignTransaction = () => {
	throw new SdkError('cosignTransaction is not implemented for Ethereum');
};

export const encryptMessage = () => {
	throw new SdkError('encryptMessage is not implemented for Ethereum');
};

export const decryptMessage = () => {
	throw new SdkError('decryptMessage is not implemented for Ethereum');
};
