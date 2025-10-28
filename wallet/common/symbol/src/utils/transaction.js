import { transactionToSymbol } from './transaction-to-symbol';
import { MessageType, TransactionType } from '../constants';
import { Hash256, PrivateKey, PublicKey, utils } from 'symbol-sdk';
import { MessageEncoder, SymbolFacade, models } from 'symbol-sdk/symbol';
import { absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Account').UnresolvedAddressWithLocation} UnresolvedAddressWithLocation */
/** @typedef {import('../types/Mosaic').BaseMosaic} BaseMosaic */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Network').TransactionFees} TransactionFees */
/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').SignedTransaction} SignedTransaction */
/** @typedef {import('../types/Transaction').CosignedTransaction} CosignedTransaction */

const { TransactionFactory } = models;

/**
 * Checks if a transaction is an aggregate transaction.
 * @param {Transaction | object} transaction - The transaction or Symbol transaction object.
 * @returns {boolean} A boolean indicating whether the transaction is an aggregate transaction.
 */
export const isAggregateTransaction = transaction => {
	const type = transaction.type || transaction.type?.value;

	return type === TransactionType.AGGREGATE_BONDED || type === TransactionType.AGGREGATE_COMPLETE;
};

/**
 * Checks if a transaction is a harvesting service transaction. 
 * It should contain a VRF, remote and node key link transactions and a transfer transaction with a delegated harvesting message.
 * @param {Transaction} transaction - The transaction object.
 * @returns {boolean} A boolean indicating whether the transaction is a harvesting service transaction.
 */
export const isHarvestingServiceTransaction = transaction => {
	if (!isAggregateTransaction(transaction))
		return false;

	const keyLinkTypes = [TransactionType.ACCOUNT_KEY_LINK, TransactionType.VRF_KEY_LINK, TransactionType.NODE_KEY_LINK];

	let hasKeyLinkTransaction = false;
	let hasUnrelatedTypes = false;
	const transferTransactions = [];

	transaction.innerTransactions.forEach(innerTransaction => {
		const isKeyLinkTransaction = keyLinkTypes.some(type => type === innerTransaction.type);
		if (isKeyLinkTransaction) {
			hasKeyLinkTransaction = true;
			return;
		}

		const isTransferTransaction = innerTransaction.type === TransactionType.TRANSFER;
		if (isTransferTransaction) {
			transferTransactions.push(innerTransaction);
			return;
		}

		hasUnrelatedTypes = true;
	});

	// If there are unrelated transaction types or more than one transfer transaction, it is not a harvesting service transaction
	if (hasUnrelatedTypes || transferTransactions.length > 1)
		return false;

	const hasTransferTransaction = transferTransactions.length === 1;
	const hasOneHarvestingRequestTransfer =
		hasTransferTransaction && transferTransactions[0].message?.type === MessageType.DelegatedHarvesting;

	// If there is a key link transaction or one transfer transaction with a delegated harvesting message, 
	// it is a harvesting service transaction
	if ((hasKeyLinkTransaction && !hasTransferTransaction) || hasOneHarvestingRequestTransfer)
		return true;

	return false;
};

/**
 * Checks whether transaction is awaiting a signature by account.
 * @param {Transaction} transaction - The transaction object.
 * @param {PublicAccount} account - The account object.
 * @returns {boolean} A boolean indicating whether the transaction is awaiting a signature by the account.
 */
export const isTransactionAwaitingSignatureByAccount = (transaction, account) => {
	if (transaction.type !== TransactionType.AGGREGATE_BONDED)
		return false;

	const isSignedByAccount = transaction.signerPublicKey === account.publicKey;
	const hasAccountCosignature = transaction.cosignatures.some(cosignature => cosignature.signerPublicKey === account.publicKey);

	return !isSignedByAccount && !hasAccountCosignature;
};

/**
 * Checks if a transaction is an outgoing transaction.
 * @param {Transaction} transaction - Transaction.
 * @param {PublicAccount} currentAccount - Current account.
 * @returns {boolean} A boolean indicating whether the transaction is an outgoing transaction.
 */
export const isOutgoingTransaction = (transaction, currentAccount) => transaction.signerAddress === currentAccount.address;

/**
 * Checks if a transaction is an incoming transaction.
 * @param {Transaction} transaction - Transaction.
 * @param {PublicAccount} currentAccount - Current account.
 * @returns {boolean} A boolean indicating whether the transaction is an incoming transaction.
 */
export const isIncomingTransaction = (transaction, currentAccount) => transaction.recipientAddress === currentAccount.address;

/**
 * Creates a Symbol transaction object from a transaction payload string.
 * @param {string} payload - The transaction payload string.
 * @returns {object} Resulting Symbol transaction object.
 */
export const symbolTransactionFromPayload = payload => {
	const transactionHex = utils.hexToUint8(payload);

	return TransactionFactory.deserialize(transactionHex);
};

/**
 * Creates a payload string from a Symbol transaction object.
 * @param {object} symbolTransaction - The Symbol transaction object.
 * @returns {string} The resulting payload string.
 */
export const symbolTransactionToPayload = symbolTransaction => {
	const bytes = symbolTransaction.serialize();

	return utils.uint8ToHex(bytes);
};

/**
 * Creates a payload string from a transaction.
 * @param {Transaction} transaction - Transaction.
 * @param {string} networkIdentifier - Network identifier.
 * @returns {string} The resulting payload string.
 */
export const transactionToPayload = (transaction, networkIdentifier) => {
	const symbolTransaction = transactionToSymbol(transaction, { networkIdentifier });

	return symbolTransactionToPayload(symbolTransaction);
};

/**
 * Encodes a plain text message into a payload HEX string.
 * @param {string} messageText - The message text.
 * @returns {string} The resulting payload HEX string.
 */
export const encodePlainMessage = messageText => {
	const bytes = new TextEncoder().encode(messageText);

	return Buffer.from([MessageType.PlainText, ...bytes]).toString('hex');
};

/**
 * Decodes a plain text message from a payload HEX string.
 * @param {string} messagePayloadHex - The message payload HEX string.
 * @returns {string} The resulting message text.
 */
export const decodePlainMessage = messagePayloadHex => {
	const messageBytes = Buffer.from(messagePayloadHex, 'hex');

	return Buffer.from(messageBytes.subarray(1)).toString();
};

/**
 * Creates a delegated harvesting request message.
 * @param {string} privateKey - Current account private key.
 * @param {string} nodePublicKey - Node public key to delegate harvesting to.
 * @param {string} remotePrivateKey - The remote account private key.
 * @param {string} vrfPrivateKey - VRF private key.
 * @returns {string} The resulting payload HEX string.
 */
export const encodeDelegatedHarvestingMessage = (privateKey, nodePublicKey, remotePrivateKey, vrfPrivateKey) => {
	const keyPair = new SymbolFacade.KeyPair(new PrivateKey(privateKey));
	const messageEncoder = new MessageEncoder(keyPair);
	const remoteKeyPair = new SymbolFacade.KeyPair(new PrivateKey(remotePrivateKey));
	const vrfKeyPair = new SymbolFacade.KeyPair(new PrivateKey(vrfPrivateKey));
	const encodedBytes = messageEncoder.encodePersistentHarvestingDelegation(new PublicKey(nodePublicKey), remoteKeyPair, vrfKeyPair);

	return Buffer.from(encodedBytes).toString('hex');
};

/**
 * Encrypts a message with a recipient public key and a sender private key.
 * @param {string} messageText - The message text.
 * @param {string} recipientPublicKey - The recipient public key.
 * @param {string} privateKey - Current account private key.
 * @returns {string} The resulting payload HEX string.
 */
export const encryptMessage = (messageText, recipientPublicKey, privateKey) => {
	const _privateKey = new PrivateKey(privateKey);
	const _recipientPublicKey = new PublicKey(recipientPublicKey);
	const keyPair = new SymbolFacade.KeyPair(_privateKey);
	const messageEncoder = new MessageEncoder(keyPair);
	const messageBytes = Buffer.from(messageText, 'utf-8');
	const encodedBytes = messageEncoder.encodeDeprecated(_recipientPublicKey, messageBytes);

	return Buffer.from(encodedBytes).toString('hex');
};

/**
 * Decrypts a message with sender or recipient public key and current account private key.
 * @param {string} encryptedMessageHex - The encrypted message HEX string.
 * @param {string} senderOrRecipientPublicKey - The sender or recipient public key.
 * @param {string} privateKey - Current account private key.
 * @returns {string} The resulting message text.
 */
export const decryptMessage = (encryptedMessageHex, senderOrRecipientPublicKey, privateKey) => {
	const _privateKey = new PrivateKey(privateKey);
	const _senderOrRecipientPublicKey = new PublicKey(senderOrRecipientPublicKey);
	const keyPair = new SymbolFacade.KeyPair(_privateKey);
	const messageEncoder = new MessageEncoder(keyPair);
	const messageBytes = Buffer.from(encryptedMessageHex, 'hex');
	const { message } = messageEncoder.tryDecodeDeprecated(_senderOrRecipientPublicKey, messageBytes);

	return Buffer.from(message).toString('utf-8');
};

/**
 * Filters transactions by keeping only the transactions which signer is not blacklisted.
 * @param {Transaction[]} transactions - The transactions array.
 * @param {PublicAccount[]} blackList - The blacklisted contacts array.
 * @returns {Transaction[]} The filtered transactions array.
 */
export const removeBlockedTransactions = (transactions, blackList) => {
	return transactions.filter(transaction => blackList.every(contact => contact.address !== transaction.signerAddress));
};

/**
 * Filters transactions by keeping only the transactions which signer is blacklisted.
 * @param {Transaction[]} transactions - The transactions array.
 * @param {PublicAccount[]} blackList - The blacklisted contacts array.
 * @returns {Transaction[]} The filtered transactions array.
 */
export const removeAllowedTransactions = (transactions, blackList) => {
	return transactions.filter(transaction => blackList.some(contact => contact.address === transaction.signerAddress));
};

/**
 * Signs a transaction with a private key.
 * @param {string} networkIdentifier - The network identifier.
 * @param {Transaction} transaction - The transaction object.
 * @param {string} privateKey - The signer account private key.
 * @returns {SignedTransaction} The signed transaction.
 */
export const signTransaction = (networkIdentifier, transaction, privateKey) => {
	// Map transaction
	const transactionOptions = {
		networkIdentifier
	};
	const transactionObject = transactionToSymbol(transaction, transactionOptions);

	// Get signature
	const facade = new SymbolFacade(networkIdentifier);
	const keyPair = new SymbolFacade.KeyPair(new PrivateKey(privateKey));
	const signature = facade.signTransaction(keyPair, transactionObject);

	// Attach signature
	const jsonString = facade.transactionFactory.constructor.attachSignature(transactionObject, signature);
	const hash = facade.hashTransaction(transactionObject).toString();

	return {
		dto: JSON.parse(jsonString),
		hash
	};
};

/**
 * Cosigns a partial transaction with a private key.
 * @param {Transaction} transaction - The transaction object.
 * @param {string} privateKey - The cosigner account private key.
 * @returns {CosignedTransaction} The cosigned transaction.
 */
export const cosignTransaction = (transaction, privateKey) => {
	const keyPair = new SymbolFacade.KeyPair(new PrivateKey(privateKey));
	const hash256 = new Hash256(transaction.hash);
	const signature = SymbolFacade.cosignTransactionHash(keyPair, hash256, true);

	return {
		dto: signature.toJson(),
		hash: transaction.hash
	};
};

/**
 * Creates a deadline object with a timestamp and adjusted timestamp.
 * @param {number} [hours=2] - The number of hours for the deadline from now.
 * @param {number} epochAdjustment - The epoch adjustment in seconds.
 * @returns {{ timestamp: number, adjusted: number }} The deadline object containing timestamp and adjusted timestamp.
 */
export const createDeadline = (hours = 2, epochAdjustment) => {
	const now = Date.now();
	const deadlineTimestamp = now + (hours * 60 * 60 * 1000);
	const adjustedDeadline = deadlineTimestamp - (epochAdjustment * 1000);

	return {
		timestamp: deadlineTimestamp,
		adjusted: adjustedDeadline
	};
};

/**
 * Creates a fee object for a transaction.
 * @param {number} amount - The fee amount in relative units.
 * @param {NetworkProperties} networkProperties - The network properties.
 * @returns {BaseMosaic} The fee object containing amount, divisibility, id, and name.
 */
export const createFee = (amount, networkProperties) => {
	return {
		amount,
		divisibility: networkProperties.networkCurrency.divisibility,
		id: networkProperties.networkCurrency.mosaicId,
		name: networkProperties.networkCurrency.name
	};
};

/**
 * Calculates the transaction size.
 * @param {string} networkIdentifier - The network identifier.
 * @param {Transaction} transaction - The transaction object.
 * @returns {number} The transaction size in bytes.
 */
export const calculateTransactionSize = (networkIdentifier, transaction) => {
	const symbolTransaction = transactionToSymbol(transaction, { networkIdentifier });

	return symbolTransaction.size;
};

/**
 * Calculates the transaction fees for a given transaction.
 * @param {NetworkProperties} networkProperties - The network properties.
 * @param {number} size - The transaction size.
 * @returns {TransactionFees} The transaction fees.
 */
export const calculateTransactionFees = (networkProperties, size) => {
	const { transactionFees } = networkProperties;
	const { divisibility } = networkProperties.networkCurrency;

	const fast = (transactionFees.minFeeMultiplier + transactionFees.averageFeeMultiplier) * size;
	const medium = (transactionFees.minFeeMultiplier + (transactionFees.averageFeeMultiplier * 0.65)) * size;
	const slow = (transactionFees.minFeeMultiplier + (transactionFees.averageFeeMultiplier * 0.35)) * size;

	return {
		fast: absoluteToRelativeAmount(fast, divisibility),
		medium: absoluteToRelativeAmount(medium, divisibility),
		slow: absoluteToRelativeAmount(slow, divisibility)
	};
};


/**
 * Gets unresolved data from transactions.
 * @param {Transaction[]} transactions - The transactions array.
 * @param {object} config - The configuration object.
 * @param {object.<string, string[]>} config.fieldsMap - The fields map.
 * @param {Function} config.mapNamespaceId - The namespace id mapper function.
 * @param {Function} config.mapMosaicId - The mosaic id mapper function.
 * @param {Function} config.mapTransactionType - The transaction type mapper function.
 * @param {Function} config.getBodyFromTransaction - The function to get the transaction body.
 * @param {Function} config.getTransactionLocation - The function to get the transaction location.
 * @param {Function} config.verifyAddress - The function to verify an address.
 * @returns {{ mosaicIds: string[], namespaceIds: string[], addresses: UnresolvedAddressWithLocation[] }} The unresolved ids.
 */
export const getUnresolvedIdsFromTransactions = (transactions, config) => {
	const {
		fieldsMap,
		mapNamespaceId,
		mapMosaicId,
		mapTransactionType,
		getBodyFromTransaction,
		getTransactionLocation,
		verifyAddress
	} = config;

	const mosaicIds = [];
	const namespaceIds = [];
	const addresses = [];
	const addressKeys = new Set();

	const pushAddress = (namespaceId, transaction, innerTransactionLocation) => {
		// Extract location from transaction. Populate location with the location of the inner transaction if provided.
		const location = getTransactionLocation(transaction);

		if (location && innerTransactionLocation)
			location.secondaryId = innerTransactionLocation.primaryId;

		// Create a unique key for the address with location to avoid duplicates.
		const key = location
			? `${namespaceId}:${location.height}:${location.primaryId}:${location.secondaryId}`
			: namespaceId;

		if (addressKeys.has(key))
			return;

		addressKeys.add(key);

		// Push unresolved address (namespaceId) with or without location.
		if (!location)
			addresses.push({ namespaceId });
		else
			addresses.push({ namespaceId, location });
	};

	transactions.forEach(item => {
		const transaction = getBodyFromTransaction(item);
		const transactionFieldsToResolve = fieldsMap[mapTransactionType(transaction.type)];

		if (isAggregateTransaction(transaction)) {
			const unresolved = getUnresolvedIdsFromTransactions(transaction.transactions, config);
			mosaicIds.push(...unresolved.mosaicIds);
			namespaceIds.push(...unresolved.namespaceIds);
			unresolved.addresses.forEach(a => pushAddress(a.namespaceId, item, a.location));
		}

		if (!transactionFieldsToResolve)
			return;

		Object.keys(transactionFieldsToResolve).forEach(mode => {
			const fields = transactionFieldsToResolve[mode];

			fields.forEach(field => {
				const value = transaction[field];

				const processors = {
					address: value => {
						if (verifyAddress(value))
							return;

						pushAddress(mapNamespaceId(value), item);
					},
					addressArray: value => {
						if (!Array.isArray(value))
							return;

						value
							.filter(address => !verifyAddress(address))
							.forEach(address => pushAddress(mapNamespaceId(address), item));
					},
					mosaic: value => {
						const mosaicId = value?.mosaicId ?? value?.id ?? value;

						if (mosaicId)
							mosaicIds.push(mapMosaicId(mosaicId));
					},
					mosaicArray: value => {
						if (!Array.isArray(value))
							return;

						value.forEach(mosaic => {
							const mosaicId = mosaic?.mosaicId ?? mosaic?.id ?? mosaic;
							
							if (mosaicId)
								mosaicIds.push(mapMosaicId(mosaicId));
						});
					},
					namespace: value => {
						namespaceIds.push(mapNamespaceId(value));
					}
				};

				const handler = processors[mode];
				if (handler)
					handler(value);
			});
		});
	});

	return {
		mosaicIds: [...new Set(mosaicIds.flat())],
		namespaceIds: [...new Set(namespaceIds.flat())],
		addresses
	};
};
