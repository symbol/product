import { transactionFromDTO } from '../../src/utils';
import {
	cosignatureDTO,
	encryptedTransferDTO,
	importanceTransferDTO,
	incomingTransferDTO,
	mixedMosaicTransferDTO,
	mosaicDefinitionDTO,
	mosaicDefinitionWithLevyDTO,
	mosaicSupplyChangeDTO,
	mosaicTransferDTO,
	multisigImportanceTransferDTO,
	multisigModificationDTO,
	multisigNativeMosaicTransferDTO,
	multisigTransferDTO,
	namespaceRegistrationDTO,
	outgoingTransferDTO,
	subNamespaceRegistrationDTO,
	unconfirmedMultisigTransferDTO,
	unconfirmedTransferDTO
} from '../__fixtures__/api/transaction-dtos';
import { networkProperties } from '../__fixtures__/local/network';
import { tokenInfos } from '../__fixtures__/local/token';
import {
	cosignature,
	encryptedTransfer,
	importanceTransfer,
	incomingTransfer,
	mixedMosaicTransfer,
	mosaicDefinition,
	mosaicDefinitionWithLevy,
	mosaicSupplyChange,
	mosaicTransfer,
	multisigImportanceTransfer,
	multisigModification,
	multisigNativeMosaicTransfer,
	multisigTransfer,
	namespaceRegistration,
	outgoingTransfer,
	subNamespaceRegistration,
	unconfirmedMultisigTransfer,
	unconfirmedTransfer
} from '../__fixtures__/local/transactions';
import { currentAccount } from '../__fixtures__/local/wallet';

// Each case pairs a NEM transaction DTO with the wallet transaction object it maps to, covering every
// transaction type the mapper supports. Read with currentAccount = alice (so alice-signed transfers
// resolve as outgoing) and a tokenInfos map that resolves the non-native 'test.token' mosaic.
const transactionFromDTOCases = [
	{ name: 'outgoing transfer', transactionDTO: outgoingTransferDTO, expected: outgoingTransfer },
	{ name: 'incoming transfer', transactionDTO: incomingTransferDTO, expected: incomingTransfer },
	{ name: 'mosaic transfer', transactionDTO: mosaicTransferDTO, expected: mosaicTransfer },
	{ name: 'encrypted transfer', transactionDTO: encryptedTransferDTO, expected: encryptedTransfer },
	{ name: 'multisig transfer', transactionDTO: multisigTransferDTO, expected: multisigTransfer },
	{ name: 'importance transfer', transactionDTO: importanceTransferDTO, expected: importanceTransfer },
	{ name: 'unconfirmed transfer', transactionDTO: unconfirmedTransferDTO, expected: unconfirmedTransfer },
	{ name: 'unconfirmed multisig transfer', transactionDTO: unconfirmedMultisigTransferDTO, expected: unconfirmedMultisigTransfer },
	{ name: 'multisig account modification', transactionDTO: multisigModificationDTO, expected: multisigModification },
	{ name: 'cosignature', transactionDTO: cosignatureDTO, expected: cosignature },
	{ name: 'namespace registration (root)', transactionDTO: namespaceRegistrationDTO, expected: namespaceRegistration },
	{ name: 'namespace registration (sub)', transactionDTO: subNamespaceRegistrationDTO, expected: subNamespaceRegistration },
	{ name: 'mosaic definition', transactionDTO: mosaicDefinitionDTO, expected: mosaicDefinition },
	{ name: 'mosaic definition with levy', transactionDTO: mosaicDefinitionWithLevyDTO, expected: mosaicDefinitionWithLevy },
	{ name: 'mosaic supply change', transactionDTO: mosaicSupplyChangeDTO, expected: mosaicSupplyChange },
	{ name: 'multisig importance transfer', transactionDTO: multisigImportanceTransferDTO, expected: multisigImportanceTransfer },
	{ name: 'mixed mosaic transfer with a multiplier', transactionDTO: mixedMosaicTransferDTO, expected: mixedMosaicTransfer },
	{
		name: 'multisig transfer of the nem:xem mosaic with a multiplier',
		transactionDTO: multisigNativeMosaicTransferDTO,
		expected: multisigNativeMosaicTransfer
	}
];

describe('utils/transaction-from-dto', () => {
	it.each(transactionFromDTOCases)('maps $name from an API DTO', ({ transactionDTO, expected }) => {
		// Arrange:
		const config = { networkProperties, currentAccount, tokenInfos };

		// Act:
		const result = transactionFromDTO(transactionDTO, config);

		// Assert:
		expect(result).toStrictEqual(expected);
	});
});
