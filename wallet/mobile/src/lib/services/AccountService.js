import { addressFromRaw } from '@/utils/account';
import { makeRequest } from '@/utils/network';
import { MosaicService } from 'src/lib/services/MosaicService';
import { getMosaicsWithRelativeAmounts } from 'src/utils';

export class AccountService {
    static async fetchAccountInfo(networkProperties, address) {
        const url = `${networkProperties.nodeUrl}/accounts/${address}`;
        const { account } = await makeRequest(url);
        const { linked, node, vrf } = account.supplementalPublicKeys;

        const mosaicIds = account.mosaics.map((mosaic) => mosaic.id);
        const mosaicInfos = await MosaicService.fetchMosaicInfos(networkProperties, mosaicIds);
        const formattedMosaics = getMosaicsWithRelativeAmounts(account.mosaics, mosaicInfos);

        return {
            address,
            publicKey: account.publicKey || null,
            mosaics: formattedMosaics,
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
