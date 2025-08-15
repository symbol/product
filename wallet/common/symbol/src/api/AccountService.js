import { absoluteToRelativeAmount, addressFromRaw, formatMosaicList, getMosaicAmount } from '../utils';
import { NotFoundError } from 'wallet-common-core';

/** @typedef {import('../types/Account').AccountInfo} AccountInfo */
/** @typedef {import('../types/Account').MultisigAccountInfo} MultisigAccountInfo */
/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

export class AccountService {
	#api;
	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches account information from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - The address of the account to fetch information for.
	 * @returns {Promise<AccountInfo>} - The account information.
	 */
	fetchAccountInfo = async (networkProperties, address) => {
		let response;
		try {
			const url = `${networkProperties.nodeUrl}/accounts/${address}`;
			response = await this.#makeRequest(url);
		} catch (error) {
			if (error instanceof NotFoundError) {
				return {
					address,
					publicKey: null,
					mosaics: [],
					balance: 0,
					importance: 0,
					linkedKeys: {
						linkedPublicKey: null,
						nodePublicKey: null,
						vrfPublicKey: null
					},
					namespaces: [],
					isMultisig: false,
					cosignatories: [],
					multisigAddresses: []
				};
			}
			
			throw error;
		}
		const { account } = response;
		const { linked, node, vrf } = account.supplementalPublicKeys;

		const mosaicIds = account.mosaics.map(mosaic => mosaic.id);
		const mosaicInfos = await this.#api.mosaic.fetchMosaicInfos(networkProperties, mosaicIds);
		const formattedMosaics = formatMosaicList(account.mosaics, mosaicInfos);
		const balance = getMosaicAmount(formattedMosaics, networkProperties.networkCurrency.mosaicId);

		let isMultisig;
		let cosignatories = [];
		let multisigAddresses = [];
		try {
			const multisigInfo = await this.fetchMultisigInfo(networkProperties, address);
			cosignatories = multisigInfo.cosignatories;
			multisigAddresses = multisigInfo.multisigAddresses;
			isMultisig = cosignatories.length > 0;
		} catch {
			isMultisig = false;
		}

		const namespaces = await this.#api.namespace.fetchAccountNamespaces(networkProperties, address);

		return {
			address,
			publicKey: account.publicKey || null,
			mosaics: formattedMosaics,
			balance,
			importance: parseInt(account.importance),
			linkedKeys: {
				linkedPublicKey: linked ? linked.publicKey : null,
				nodePublicKey: node ? node.publicKey : null,
				vrfPublicKey: vrf ? vrf.publicKey : null
			},
			namespaces,
			isMultisig,
			cosignatories,
			multisigAddresses
		};
	};

	/**
	 * Fetches the native currency balance of an account from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - Requested account address.
	 * @returns {Promise<number>} - The account balance.
	 */
	fetchAccountBalance = async (networkProperties, address) => {
		const url = `${networkProperties.nodeUrl}/accounts/${address}`;
		const { account } = await this.#makeRequest(url);

		const nativeCurrencyAbsoluteBalance = getMosaicAmount(account.mosaics, networkProperties.networkCurrency.mosaicId);
		const balance = absoluteToRelativeAmount(nativeCurrencyAbsoluteBalance, networkProperties.networkCurrency.divisibility);

		return balance;
	};

	/**
	 * Fetches multisig info of an account from the node.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - Requested account address.
	 * @returns {Promise<MultisigAccountInfo>} - The account multisig information.
	 */
	fetchMultisigInfo = async (networkProperties, address) => {
		const url = `${networkProperties.nodeUrl}/account/${address}/multisig`;
		const accountInfo = await this.#makeRequest(url);

		return {
			multisigAddresses: accountInfo.multisig.multisigAddresses.map(address => addressFromRaw(address)),
			cosignatories: accountInfo.multisig.cosignatoryAddresses.map(address => addressFromRaw(address)),
			minApproval: accountInfo.multisig.minApproval,
			minRemoval: accountInfo.multisig.minRemoval
		};
	};
}
