import * as WalletContext from '../context/store';
import { render } from '@testing-library/react';

const testHelper = {
	customRender: (ui, context) => {
		return render(<WalletContext.default value={context}>
			{ui}
		</WalletContext.default>);
	},
	generateAccountsState: numberOfAccounts => {
		const accounts = {};

		for (let index = 0; index < numberOfAccounts; index++) {
			const accountId = `accountId ${index}`;
			accounts[accountId] = {
				id: accountId,
				addressIndex: index,
				type: 'metamask',
				networkName: 'network',
				label: `Account ${index}`,
				address: `Address ${index}`,
				publicKey: `publicKey ${index}`
			};
		}
		return accounts;
	}
};

export default testHelper;
