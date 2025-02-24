import { addressFromRaw } from '@/app/utils/account';
import { makeRequest } from '@/app/utils/network';
import { MosaicService } from '@/app/lib/services/MosaicService';
import { absoluteToRelativeAmount, getMosaicAmount, mosaicListFromRaw } from '@/app/utils';
import * as AccountTypes from '@/app/types/Account';
import * as NetworkTypes from '@/app/types/Network';
export class AccountService {
    /**
     * Fetches account information from the node.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string} address - Requested account address.
     * @returns {Promise<AccountTypes.BaseAccountInfo>} - The account information.
     */
    static async fetchAccountInfo(networkProperties, address) {
        const url = `${networkProperties.nodeUrl}/accounts/${address}`;
        const { account } = await makeRequest(url);
        const { linked, node, vrf } = account.supplementalPublicKeys;

        const mosaicIds = account.mosaics.map((mosaic) => mosaic.id);
        const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
        const formattedMosaics = mosaicListFromRaw(account.mosaics, mosaicInfos);
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
                vrfPublicKey: vrf ? vrf.publicKey : null,
            },
        };
    }

    /**
     * Fetches the native currency balance of an account from the node.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string} address - Requested account address.
     * @returns {Promise<number>} - The account balance.
     */
    static async fetchAccountBalance(networkProperties, address) {
        const url = `${networkProperties.nodeUrl}/accounts/${address}`;
        const { account } = await makeRequest(url);

        const nativeCurrencyAbsoluteBalance = getMosaicAmount(account.mosaics, networkProperties.networkCurrency.mosaicId);
        const balance = absoluteToRelativeAmount(nativeCurrencyAbsoluteBalance, networkProperties.networkCurrency.divisibility);

        return balance;
    }

    /**
     * Fetches multisig info of an account from the node.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string} address - Requested account address.
     * @returns {Promise<AccountTypes.MultisigAccountInfo>} - The account multisig information.
     */
    static async fetchMultisigInfo(networkProperties, address) {
        const url = `${networkProperties.nodeUrl}/account/${address}/multisig`;
        const accountInfo = await makeRequest(url);

        return {
            multisigAddresses: accountInfo.multisig.multisigAddresses.map((address) => addressFromRaw(address)),
            cosignatories: accountInfo.multisig.cosignatoryAddresses.map((address) => addressFromRaw(address)),
            minApproval: accountInfo.multisig.minApproval,
            minRemoval: accountInfo.multisig.minRemoval,
        };
    }
}
