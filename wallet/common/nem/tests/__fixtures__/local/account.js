import { accountMosaics } from './mosaic';
import { walletStorageAccounts } from './wallet';

const currentAccount = walletStorageAccounts.testnet[0];
const multisigAccount = walletStorageAccounts.testnet[1];
const secondCosignatory = walletStorageAccounts.testnet[2];

// AccountInfo for a regular account that owns the resolved account mosaics, with a 1.5 XEM balance.
export const accountInfo = {
	address: currentAccount.address,
	publicKey: currentAccount.publicKey,
	mosaics: accountMosaics,
	balance: '1.5',
	importance: 0.0001,
	isMultisig: false,
	multisigAddresses: [],
	cosignatories: []
};

// AccountInfo for a 2-of-2 multisig account (no public key on chain, owns no mosaics).
export const multisigAccountInfo = {
	address: multisigAccount.address,
	publicKey: null,
	mosaics: [],
	balance: '5',
	importance: 0,
	isMultisig: true,
	multisigAddresses: [],
	cosignatories: [currentAccount.address, secondCosignatory.address],
	minApproval: 2
};

// AccountInfo returned for an address the node does not know (the /account/get request 404s).
export const notFoundAccountInfo = {
	address: currentAccount.address,
	publicKey: null,
	mosaics: [],
	balance: 0,
	importance: 0,
	isMultisig: false,
	multisigAddresses: [],
	cosignatories: []
};

// MultisigAccountInfo for the multisig account above.
export const multisigInfo = {
	cosignatories: [currentAccount.address, secondCosignatory.address],
	multisigAddresses: [],
	minApproval: 2
};
