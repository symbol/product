import { makeRequest } from 'src/utils';

export class AccountService {
    static async fetchAccountInfo(networkProperties, address) {
        const url = `${networkProperties.nodeUrl}/accounts/${address}`;
        const accountInfo = await makeRequest(url);

        return accountInfo.account;
    }
}
