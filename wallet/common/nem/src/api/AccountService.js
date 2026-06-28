import { NotFoundError, absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Account').AccountInfo} AccountInfo */
/** @typedef {import('../types/Account').MultisigAccountInfo} MultisigAccountInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */


const extractAddressFromList = list => list?.map(info => info.address) || [];

export class AccountService {
	#api;
	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches the raw account data from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<object>} The raw account data containing the account and its meta.
	 */
	#fetchAccountData = (networkProperties, address) =>
		this.#makeRequest(`${networkProperties.nodeUrl}/account/get?address=${address}`);

	/**
	 * Fetches account information from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<AccountInfo>} The account info (a default empty info when the account is unknown).
	 */
	fetchAccountInfo = async (networkProperties, address) => {
		let accountData;
		try {
			accountData = await this.#fetchAccountData(networkProperties, address);
		} catch (error) {
			if (error instanceof NotFoundError || error.statusCode === 404) {
				return {
					address,
					publicKey: null,
					mosaics: [],
					balance: 0,
					importance: 0,
					isMultisig: false,
					multisigAddresses: [],
					cosignatories: []
				};
			}
			throw error;
		}

		const mosaics = await this.#api.mosaic.fetchAccountMosaics(networkProperties, address);

		const { account, meta } = accountData;
		const balance = absoluteToRelativeAmount(
			account.balance,
			networkProperties.networkCurrency.divisibility
		);
		const cosignatories = extractAddressFromList(meta.cosignatories);
		const multisigAddresses = extractAddressFromList(meta.cosignatoryOf);
		const isMultisig = cosignatories.length > 0;

		return {
			address: account.address,
			publicKey: account.publicKey || null,
			mosaics,
			balance,
			importance: account.importance || 0,
			isMultisig,
			multisigAddresses,
			cosignatories,
			...(isMultisig ? { minApproval: account.multisigInfo.minCosignatories || 0 } : {})
		};
	};

	/**
	 * Fetches the native currency balance of an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<string>} The relative balance amount.
	 */
	fetchAccountBalance = async (networkProperties, address) => {
		const { account } = await this.#fetchAccountData(networkProperties, address);

		return absoluteToRelativeAmount(account.balance, networkProperties.networkCurrency.divisibility);
	};

	/**
	 * Fetches multisig info of an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The account address.
	 * @returns {Promise<MultisigAccountInfo>} The multisig cosignatories, multisig parents and approval threshold.
	 */
	fetchMultisigInfo = async (networkProperties, address) => {
		const { account, meta } = await this.#fetchAccountData(networkProperties, address);

		return {
			cosignatories: extractAddressFromList(meta.cosignatories),
			multisigAddresses: extractAddressFromList(meta.cosignatoryOf),
			minApproval: account.multisigInfo.minCosignatories
		};
	};
}
