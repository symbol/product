import { transactionFromDTO } from '../../src/utils';
import {
	cosignatureDTO,
	encryptedTransferDTO,
	importanceTransferDTO,
	incomingTransferDTO,
	mosaicDefinitionDTO,
	mosaicDefinitionWithLevyDTO,
	mosaicSupplyChangeDTO,
	mosaicTransferDTO,
	multisigImportanceTransferDTO,
	multisigModificationDTO,
	multisigTransferDTO,
	namespaceRegistrationDTO,
	outgoingTransferDTO,
	subNamespaceRegistrationDTO,
	unconfirmedTransferDTO
} from '../__fixtures__/api/transaction-dtos';
import { mosaicInfos } from '../__fixtures__/local/mosaic';
import { networkProperties } from '../__fixtures__/local/network';
import {
	cosignature,
	encryptedTransfer,
	importanceTransfer,
	incomingTransfer,
	mosaicDefinition,
	mosaicDefinitionWithLevy,
	mosaicSupplyChange,
	mosaicTransfer,
	multisigImportanceTransfer,
	multisigModification,
	multisigTransfer,
	namespaceRegistration,
	outgoingTransfer,
	subNamespaceRegistration,
	unconfirmedTransfer
} from '../__fixtures__/local/transactions';
import { currentAccount } from '../__fixtures__/local/wallet';

// Each case pairs a NEM transaction DTO with the wallet transaction object it maps to, covering every
// transaction type the mapper supports. Read with currentAccount = alice (so alice-signed transfers
// resolve as outgoing) and a mosaicInfos map that resolves the non-native 'test.token' mosaic.
const transactionFromDTOCases = [
	{ name: 'outgoing transfer', transactionDTO: outgoingTransferDTO, expected: outgoingTransfer },
	{ name: 'incoming transfer', transactionDTO: incomingTransferDTO, expected: incomingTransfer },
	{ name: 'mosaic transfer', transactionDTO: mosaicTransferDTO, expected: mosaicTransfer },
	{ name: 'encrypted transfer', transactionDTO: encryptedTransferDTO, expected: encryptedTransfer },
	{ name: 'multisig transfer', transactionDTO: multisigTransferDTO, expected: multisigTransfer },
	{ name: 'importance transfer', transactionDTO: importanceTransferDTO, expected: importanceTransfer },
	{ name: 'unconfirmed transfer', transactionDTO: unconfirmedTransferDTO, expected: unconfirmedTransfer },
	{ name: 'multisig account modification', transactionDTO: multisigModificationDTO, expected: multisigModification },
	{ name: 'cosignature', transactionDTO: cosignatureDTO, expected: cosignature },
	{ name: 'namespace registration (root)', transactionDTO: namespaceRegistrationDTO, expected: namespaceRegistration },
	{ name: 'namespace registration (sub)', transactionDTO: subNamespaceRegistrationDTO, expected: subNamespaceRegistration },
	{ name: 'mosaic definition', transactionDTO: mosaicDefinitionDTO, expected: mosaicDefinition },
	{ name: 'mosaic definition with levy', transactionDTO: mosaicDefinitionWithLevyDTO, expected: mosaicDefinitionWithLevy },
	{ name: 'mosaic supply change', transactionDTO: mosaicSupplyChangeDTO, expected: mosaicSupplyChange },
	{ name: 'multisig importance transfer', transactionDTO: multisigImportanceTransferDTO, expected: multisigImportanceTransfer }
];

describe('utils/transaction-from-dto', () => {
	it.each(transactionFromDTOCases)('maps $name from an API DTO', ({ transactionDTO, expected }) => {
		// Arrange:
		const config = { networkProperties, currentAccount, mosaicInfos };

		// Act:
		const result = transactionFromDTO(transactionDTO, config);

		// Assert:
		expect(result).toStrictEqual(expected);
	});
});
