import { stubAccounts, stubHarvestedBlocks } from './fixtures';
import { stubPage } from './stub';
import { createApiUrl, createTryFetchInfoFunction, makeRequest } from '@/app/utils/server';

export const fetchAccountPage = stubPage(stubAccounts);

/**
 * Fetches the account info by address.
 * @param {string} address - requested account address
 * @returns {Promise<object|null>} account info or null when the account is not found
 */
export const fetchAccountInfo = createTryFetchInfoFunction(async address => {
	const accountInfo = await makeRequest(createApiUrl(`account?address=${address}`));

	return accountInfoFromDTO(accountInfo);
});

/**
 * Fetches the account info by public key.
 * @param {string} publicKey - requested account public key
 * @returns {Promise<object|null>} account info or null when the account is not found
 */
export const fetchAccountInfoByPublicKey = createTryFetchInfoFunction(async publicKey => {
	const accountInfo = await makeRequest(createApiUrl(`account?publicKey=${publicKey}`));

	return accountInfoFromDTO(accountInfo);
});

export const fetchAccountHarvestedBlockPage = stubPage(stubHarvestedBlocks);

/**
 * Maps the Symbol account detail DTO to the account page model.
 * @param {object} data - raw data from the Explorer REST response
 * @returns {object} mapped account info
 */
const accountInfoFromDTO = data => {
	const isRemoteAccount = 'remote' === data.accountType;
	const linkedAddress = data.supplementalKeys.linked;
	const [importanceSignificand, importanceExponent = '0'] = data.importance.toString().split('e');

	return {
		// The linked key identifies the opposite role: main -> remote, remote -> main.
		linkedAddress: isRemoteAccount ? null : linkedAddress,
		mainAddress: isRemoteAccount ? linkedAddress : null,
		address: data.address,
		publicKey: data.publicKey,
		description: data.description,
		balance: data.balance,
		// Symbol account detail REST does not expose vestedBalance.
		vestedBalance: null,
		mosaics: data.mosaics.map(item => ({
			name: item.name,
			id: item.id,
			amount: item.amount,
			isCreatedByAccount: item.isCreatedByAccount
		})),
		// Shift the decimal exponent to avoid binary floating-point multiplication error.
		importance: Number(`${importanceSignificand}e${Number(importanceExponent) + 2}`),
		harvestedBlocks: data.harvestedBlocks,
		harvestedFees: data.harvestedFees,
		height: data.height,
		minCosignatories: data.minCosignatories,
		cosignatoryOf: data.cosignatoryOf,
		cosignatories: data.cosignatories,
		isMultisig: data.isMultisig,
		isHarvestingActive: data.isHarvestingActive
	};
};
