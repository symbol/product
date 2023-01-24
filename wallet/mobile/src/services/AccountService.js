import { addressFromRaw, makeRequest } from 'src/utils';

export class AccountService {
    static async fetchAccountInfo(networkProperties, address) {
        const url = `${networkProperties.nodeUrl}/accounts/${address}`;
        const accountInfo = await makeRequest(url);

        return accountInfo.account;
    }

    static async fetchMultisigInfo(networkProperties, address) {
        const url = `${networkProperties.nodeUrl}/account/${address}/multisig`;
        const accountInfo = await makeRequest(url);

        return {
            cosignatories: accountInfo.multisig.cosignatoryAddresses.map(address => addressFromRaw(address)),
            minApproval: accountInfo.multisig.minApproval,
            minRemoval: accountInfo.multisig.minRemoval,
        };
    }
}
