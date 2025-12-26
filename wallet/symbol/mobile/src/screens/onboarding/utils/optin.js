import { optInPublicKeys } from '@/app/config';
import { constants , createOptInPrivateKeyFromMnemonic, createPrivateAccount } from 'wallet-common-symbol';

export const getOptinAccountFromMnemonic = mnemonic => {
	const optInPrivateKey = createOptInPrivateKeyFromMnemonic(mnemonic);
	const account = createPrivateAccount(optInPrivateKey, constants.NetworkIdentifier.MAIN_NET);

	if (optInPublicKeys.includes(account.publicKey))
		return account;

	return null;
};
