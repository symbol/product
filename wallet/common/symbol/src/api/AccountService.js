import { addressFromRaw, formatMosaicList, getMosaicAmount, promiseAllSettled } from '../utils';
import { NotFoundError, absoluteToRelativeAmount } from 'wallet-common-core';

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
		// Fetch account info from the node
		let response;
		try {
			const url = `${networkProperties.nodeUrl}/accounts/${address}`;
			response = await this.#makeRequest(url);
		} catch (error) {
			if (error instanceof NotFoundError || error.statusCode === 404) {
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
		const accountOwnedMosaicIds = account.mosaics.map(mosaic => mosaic.id);

		// Fetch mosaic infos, multisig info, and namespaces in parallel
		const [mosaicInfos, multisigInfo, namespaces] = await promiseAllSettled([
			this.#api.mosaic.fetchMosaicInfos(networkProperties, accountOwnedMosaicIds),
			this.fetchMultisigInfo(networkProperties, address),
			this.#api.namespace.fetchAccountNamespaces(networkProperties, address)
		]);
		const isMultisigRequestSucceeded = multisigInfo.status === 'fulfilled';

		// Format mosaic list and calculate balance
		const formattedMosaics = formatMosaicList(account.mosaics, mosaicInfos.value);
		const balance = getMosaicAmount(formattedMosaics, networkProperties.networkCurrency.mosaicId);

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
			namespaces: namespaces.value,
			isMultisig: isMultisigRequestSucceeded && multisigInfo.value.cosignatories.length > 0,
			cosignatories: isMultisigRequestSucceeded ? multisigInfo.value.cosignatories : [],
			multisigAddresses: isMultisigRequestSucceeded ? multisigInfo.value.multisigAddresses : []
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
