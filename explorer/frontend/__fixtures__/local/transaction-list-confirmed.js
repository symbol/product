/* eslint-disable max-len */
import {
	accountKeyLinkConfirmedTransaction,
	mosaicDefinitionConfirmedTransaction,
	mosaicSupplyChangeConfirmedTransaction,
	multisigAccountModificationConfirmedTransaction,
	multisigConfirmedTransaction,
	multisigMultisigAccountModificationConfirmedTransaction,
	multisigNamespaceRegistrationConfirmedTransaction,
	namespaceRegistrationConfirmedTransaction,
	transferConfirmedTransaction,
	transferCustomMosaicOnlyConfirmedTransaction,
	transferDecimalAmountConfirmedTransaction,
	transferEncryptedMessageConfirmedTransaction,
	transferMultipleMosaicsConfirmedTransaction,
	transferNoMessageConfirmedTransaction
} from './transaction';

// eslint-disable-next-line no-unused-vars
const withoutAccountStateChange = ({ accountStateChange, ...transaction }) => transaction;

export const transactionListConfirmed = [
	transferConfirmedTransaction,
	transferNoMessageConfirmedTransaction,
	namespaceRegistrationConfirmedTransaction,
	mosaicDefinitionConfirmedTransaction,
	multisigMultisigAccountModificationConfirmedTransaction,
	multisigAccountModificationConfirmedTransaction,
	accountKeyLinkConfirmedTransaction,
	mosaicSupplyChangeConfirmedTransaction,
	multisigConfirmedTransaction,
	transferEncryptedMessageConfirmedTransaction,
	multisigNamespaceRegistrationConfirmedTransaction,
	transferCustomMosaicOnlyConfirmedTransaction,
	transferMultipleMosaicsConfirmedTransaction,
	transferDecimalAmountConfirmedTransaction
].map(withoutAccountStateChange);

export const accountTransactionListConfirmed = [
	{
		type: 'TRANSFER',
		group: 'confirmed',
		hash: 'BF6EFE9F384629C4D4C88CF1C609113790F828D1BC26C1FEDFEF28260D8B59E0',
		timestamp: '2026-06-05 21:52:33',
		deadline: '2026-06-05 23:52:33',
		signer: 'TDQIZK6LUOYP7VXPZRLQKPW4Z2BZMSVAVY57C4VD',
		sender: 'TDQIZK6LUOYP7VXPZRLQKPW4Z2BZMSVAVY57C4VD',
		recipient: 'TCLXLP37WC7L3UUUW4FFFOFGT4DBEHMLIKSSZCJR',
		account: 'TCLXLP37WC7L3UUUW4FFFOFGT4DBEHMLIKSSZCJR',
		direction: 'outgoing',
		height: 645773,
		signature:
			'02447BFBE749DF89A72DBA09B814DAF28390F1827CB6D55DAF60F3ACD46D2C410BC82E6BD68E704DCB1DD189408721F96536E1D6AAD481AB8297BB5326EE580C',
		fee: 0.05,
		amount: 10,
		value: [
			{
				id: 'nem.xem',
				name: 'nem.xem',
				amount: 10
			}
		],
		body: [
			{
				type: 'TRANSFER',
				sender: 'TDQIZK6LUOYP7VXPZRLQKPW4Z2BZMSVAVY57C4VD',
				recipient: 'TCLXLP37WC7L3UUUW4FFFOFGT4DBEHMLIKSSZCJR',
				mosaics: [
					{
						id: 'nem.xem',
						name: 'nem.xem',
						amount: 10
					}
				],
				message: null
			}
		],
		size: 188,
		version: 2
	},
	{
		type: 'TRANSFER',
		group: 'confirmed',
		hash: '94CE812161B06DA35A618CE548F8756C4DB2FE397B0DCF5DC3B44FB1DF5003F0',
		timestamp: '2026-06-05 13:52:12',
		deadline: '2026-06-05 14:52:12',
		signer: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
		sender: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
		recipient: 'TDQIZK6LUOYP7VXPZRLQKPW4Z2BZMSVAVY57C4VD',
		account: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
		direction: 'incoming',
		height: 645297,
		signature:
			'444C960835AF8ECBC041C780FA3C1D7DF8221CDA06E24871741C4D7AB77A902FB5D30FD58CC8AF1AAF729EA7782D798157C854CCC2A2CA1A370B192D4AA41E07',
		fee: 0.1,
		amount: 1000,
		value: [
			{
				id: 'nem.xem',
				name: 'nem.xem',
				amount: 1000
			}
		],
		body: [
			{
				type: 'TRANSFER',
				sender: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
				recipient: 'TDQIZK6LUOYP7VXPZRLQKPW4Z2BZMSVAVY57C4VD',
				mosaics: [
					{
						id: 'nem.xem',
						name: 'nem.xem',
						amount: 1000
					}
				],
				message: {
					type: 'plain',
					text: 'Good Luck!'
				}
			}
		],
		size: 202,
		version: 1
	}
];
