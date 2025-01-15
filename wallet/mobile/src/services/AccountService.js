import { addressFromRaw } from '@/utils/account';
import { makeRequest } from '@/utils/network';

export class AccountService {
    static async fetchAccountInfo(networkProperties, address) {
        const url = `${networkProperties.nodeUrl}/accounts/${address}`;
        const { account } = await makeRequest(url);
        const { linked, node, vrf } = account.supplementalPublicKeys;

        return {
            address,
            publicKey: account.publicKey,
            mosaics: account.mosaics,
            importance: parseInt(account.importance),
            linkedKeys: {
                linkedPublicKey: linked ? linked.publicKey : null,
                nodePublicKey: node ? node.publicKey : null,
                vrfPublicKey: vrf ? vrf.publicKey : null,
            },
        };
    }

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
