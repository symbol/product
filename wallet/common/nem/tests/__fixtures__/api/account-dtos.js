import { walletStorageAccounts } from '../local/wallet';

// Real NEM /account/get response shapes from the NIS API documentation. Cosignatory entries are full
// account objects on the node; only their address is consumed, so they are reduced to { address } here.

const currentAccount = walletStorageAccounts.testnet[0];
const multisigAccount = walletStorageAccounts.testnet[1];
const secondCosignatory = walletStorageAccounts.testnet[2];

// A regular (non-multisig) account with a 1.5 XEM balance (balance is in absolute microXEM).
export const regularAccountResponse = {
	account: {
		address: currentAccount.address,
		balance: 1500000,
		vestedBalance: 1500000,
		importance: 0.0001,
		publicKey: currentAccount.publicKey,
		label: null,
		harvestedBlocks: 0,
		multisigInfo: {}
	},
	meta: {
		cosignatoryOf: [],
		cosignatories: [],
		status: 'LOCKED',
		remoteStatus: 'ACTIVE'
	}
};

// A 2-of-2 multisig account cosigned by two accounts.
export const multisigAccountResponse = {
	account: {
		address: multisigAccount.address,
		balance: 5000000,
		vestedBalance: 5000000,
		importance: 0,
		publicKey: null,
		label: null,
		harvestedBlocks: 0,
		multisigInfo: { cosignatoriesCount: 2, minCosignatories: 2 }
	},
	meta: {
		cosignatoryOf: [],
		cosignatories: [{ address: currentAccount.address }, { address: secondCosignatory.address }],
		status: 'LOCKED',
		remoteStatus: 'INACTIVE'
	}
};
