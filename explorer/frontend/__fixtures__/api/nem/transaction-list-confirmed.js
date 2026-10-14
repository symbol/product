/* eslint-disable max-len */
import {
	accountKeyLinkConfirmedTransactionResponse,
	mosaicDefinitionConfirmedTransactionResponse,
	mosaicSupplyChangeConfirmedTransactionResponse,
	multisigAccountModificationConfirmedTransactionResponse,
	multisigConfirmedTransactionResponse,
	multisigMultisigAccountModificationConfirmedTransactionResponse,
	multisigNamespaceRegistrationConfirmedTransactionResponse,
	namespaceRegistrationConfirmedTransactionResponse,
	transferConfirmedTransactionResponse,
	transferCustomMosaicOnlyConfirmedTransactionResponse,
	transferDecimalAmountConfirmedTransactionResponse,
	transferEncryptedMessageConfirmedTransactionResponse,
	transferMultipleMosaicsConfirmedTransactionResponse,
	transferNoMessageConfirmedTransactionResponse
} from './transaction-info';

export const transactionListConfirmedResponse = [
	transferConfirmedTransactionResponse,
	transferNoMessageConfirmedTransactionResponse,
	namespaceRegistrationConfirmedTransactionResponse,
	mosaicDefinitionConfirmedTransactionResponse,
	multisigMultisigAccountModificationConfirmedTransactionResponse,
	multisigAccountModificationConfirmedTransactionResponse,
	accountKeyLinkConfirmedTransactionResponse,
	mosaicSupplyChangeConfirmedTransactionResponse,
	multisigConfirmedTransactionResponse,
	transferEncryptedMessageConfirmedTransactionResponse,
	multisigNamespaceRegistrationConfirmedTransactionResponse,
	transferCustomMosaicOnlyConfirmedTransactionResponse,
	transferMultipleMosaicsConfirmedTransactionResponse,
	transferDecimalAmountConfirmedTransactionResponse
];

export const accountTransactionListConfirmedResponse = [
	{
		deadline: '2026-06-05 23:52:33',
		embeddedTransactions: null,
		fee: 0.05,
		fromAddress: 'TDQIZK6LUOYP7VXPZRLQKPW4Z2BZMSVAVY57C4VD',
		height: 645773,
		signature:
			'02447BFBE749DF89A72DBA09B814DAF28390F1827CB6D55DAF60F3ACD46D2C410BC82E6BD68E704DCB1DD189408721F96536E1D6AAD481AB8297BB5326EE580C',
		size: 188,
		timestamp: '2026-06-05 21:52:33',
		toAddress: 'TCLXLP37WC7L3UUUW4FFFOFGT4DBEHMLIKSSZCJR',
		transactionHash: 'BF6EFE9F384629C4D4C88CF1C609113790F828D1BC26C1FEDFEF28260D8B59E0',
		transactionType: 'TRANSFER',
		value: [
			{
				amount: 10,
				namespace: 'nem.xem'
			}
		],
		version: 2
	},
	{
		deadline: '2026-06-05 14:52:12',
		embeddedTransactions: null,
		fee: 0.1,
		fromAddress: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
		height: 645297,
		signature:
			'444C960835AF8ECBC041C780FA3C1D7DF8221CDA06E24871741C4D7AB77A902FB5D30FD58CC8AF1AAF729EA7782D798157C854CCC2A2CA1A370B192D4AA41E07',
		size: 202,
		timestamp: '2026-06-05 13:52:12',
		toAddress: 'TDQIZK6LUOYP7VXPZRLQKPW4Z2BZMSVAVY57C4VD',
		transactionHash: '94CE812161B06DA35A618CE548F8756C4DB2FE397B0DCF5DC3B44FB1DF5003F0',
		transactionType: 'TRANSFER',
		value: [
			{
				message: {
					payload: '476f6f64204c75636b21',
					type: 1
				}
			},
			{
				amount: 1000,
				namespace: 'nem.xem'
			}
		],
		version: 1
	}
];
