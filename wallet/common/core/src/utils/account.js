export const getAccountWithoutPrivateKey = account => {
	/* eslint-disable no-unused-vars */
	const { privateKey, ...accountWithoutPrivateKey } = account;

	return accountWithoutPrivateKey;
};
