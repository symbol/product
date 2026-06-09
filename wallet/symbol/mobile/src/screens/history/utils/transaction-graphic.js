import { SymbolTransactionType } from '@/app/constants';
import { $t } from '@/app/localization';
import {
	CaptionType,
	TransactionGraphicAvatarType
} from '@/app/screens/history/types/TransactionGraphic';
import { createAccountDisplayData } from '@/app/utils/account';
import { createTokenDisplayData, getNativeCurrencyToken, hasNonNativeCurrencyTokens } from '@/app/utils/token';

/** @typedef {import('@/app/screens/history/types/TransactionGraphic').TransactionGraphicArrowCaption} TransactionGraphicArrowCaption */
/** @typedef {import('@/app/screens/history/types/TransactionGraphic').TransactionGraphicData} TransactionGraphicData */
/** @typedef {import('@/app/screens/history/types/TransactionGraphic').TransactionGraphicSide} TransactionGraphicSide */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */

/**
 * Target field configuration for extracting target data from a transaction.
 * @typedef {object} TargetFieldConfig
 * @property {string} [addressField] - Transaction field containing the target address.
 * @property {string} [valueField] - Transaction field containing the target value/label.
 * @property {string} [imageIdField] - Transaction field containing the image id.
 * @property {function(*): string} [valueFormat] - Optional formatter function for computing the target value.
 */

/**
 * Arrow caption configuration.
 * @typedef {object} ArrowCaptionConfig
 * @property {'icon' | 'text'} type - Type of content.
 * @property {string} [icon] - Icon name for icon type.
 * @property {string} [field] - Transaction field for text type.
 * @property {(value: any, transaction: Transaction, options: TransactionGraphicOptions) => string} [format] 
 * - Formatter function for the field value.
 * @property {(transaction: Transaction, options: TransactionGraphicOptions) => boolean} [condition] 
 * - Function returning boolean to conditionally include this caption.
 */

/**
 * Transaction graphic configuration for a specific transaction type.
 * @typedef {object} TransactionGraphicConfig
 * @property {TransactionGraphicAvatarType} targetType - Avatar type for the target.
 * @property {TargetFieldConfig} targetFields - Fields configuration for extracting target data.
 * @property {ArrowCaptionConfig[]} [arrowCaptions] - Configuration for arrow captions.
 * @property {function(*): string} [typeTextKey] - Optional function to compute type text translation key.
 */

/** @type {Record<number, TransactionGraphicConfig>} */
const transactionGraphicConfigMap = {
	[SymbolTransactionType.TRANSFER]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'recipientAddress' },
		typeTextKey: tx => {
			if (tx.message?.isDelegatedHarvestingMessage)
				return `transactionDescriptor_${tx.type}_harvesting`;

			return null;
		},
		arrowCaptions: [
			{ 
				type: CaptionType.ICON, 
				icon: 'message', 
				condition: tx => !!tx.message 
			},
			{ 
				type: CaptionType.ICON, 
				icon: 'token-custom', 
				condition: (tx, options) => hasNonNativeCurrencyTokens(tx.mosaics || tx.tokens || [], options.nativeCurrencyTokenId) 
			},
			{ 
				type: CaptionType.TEXT,
				format: (_, tx, options) => {
					const nativeToken = getNativeCurrencyToken(tx.mosaics || tx.tokens || [], options.nativeCurrencyTokenId);

					return `${formatAmount(nativeToken?.amount)} ${options.nativeCurrencyTicker}`;
				}
			}
		]
	},
	[SymbolTransactionType.NAMESPACE_REGISTRATION]: {
		targetType: TransactionGraphicAvatarType.NAMESPACE,
		targetFields: { valueField: 'namespaceName' }
	},
	[SymbolTransactionType.MOSAIC_ALIAS]: {
		targetType: TransactionGraphicAvatarType.TOKEN,
		targetFields: { valueField: 'mosaicId' },
		arrowCaptions: [
			{ type: CaptionType.TEXT, field: 'namespaceName' }
		]
	},
	[SymbolTransactionType.ADDRESS_ALIAS]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'address' },
		arrowCaptions: [
			{ type: CaptionType.TEXT, field: 'namespaceName' }
		]
	},
	[SymbolTransactionType.MOSAIC_DEFINITION]: {
		targetType: TransactionGraphicAvatarType.TOKEN,
		targetFields: { valueField: 'mosaicId' }
	},
	[SymbolTransactionType.MOSAIC_SUPPLY_CHANGE]: {
		targetType: TransactionGraphicAvatarType.TOKEN,
		targetFields: { valueField: 'mosaicId' },
		arrowCaptions: [
			{ type: CaptionType.TEXT, field: 'delta' }
		]
	},
	[SymbolTransactionType.MOSAIC_SUPPLY_REVOCATION]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'sourceAddress' },
		arrowCaptions: [
			{ type: CaptionType.ICON, icon: 'tokens' },
			{ type: CaptionType.TEXT, field: 'mosaicId' }
		]
	},
	[SymbolTransactionType.ACCOUNT_MOSAIC_RESTRICTION]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'signerAddress' },
		arrowCaptions: [
			{ 
				type: CaptionType.TEXT, 
				field: 'restrictionType', 
				format: value => $t(`data_${value}`) 
			}
		]
	},
	[SymbolTransactionType.ACCOUNT_ADDRESS_RESTRICTION]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'signerAddress' },
		arrowCaptions: [
			{ 
				type: CaptionType.TEXT, 
				field: 'restrictionType', 
				format: value => $t(`data_${value}`) 
			}
		]
	},
	[SymbolTransactionType.ACCOUNT_OPERATION_RESTRICTION]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'signerAddress' },
		arrowCaptions: [
			{ type: CaptionType.TEXT, field: 'restrictionType', format: value => $t(`data_${value}`) }
		]
	},
	[SymbolTransactionType.MOSAIC_GLOBAL_RESTRICTION]: {
		targetType: TransactionGraphicAvatarType.TOKEN,
		targetFields: { valueField: 'referenceMosaicId' },
		arrowCaptions: [
			{
				type: CaptionType.TEXT,
				format: (_, tx) => `${tx.restrictionKey} ${$t(`data_${tx.newRestrictionType}`)} ${tx.newRestrictionValue}`
			}
		]
	},
	[SymbolTransactionType.MOSAIC_ADDRESS_RESTRICTION]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'targetAddress' },
		arrowCaptions: [
			{
				type: CaptionType.TEXT,
				format: (_, tx) => `${tx.restrictionKey} = ${tx.newRestrictionValue}`
			}
		]
	},
	[SymbolTransactionType.MULTISIG_ACCOUNT_MODIFICATION]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'signerAddress' }
	},
	[SymbolTransactionType.VRF_KEY_LINK]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'linkedAccountAddress' },
		arrowCaptions: [
			{   
				type: CaptionType.TEXT, 
				field: 'linkAction', 
				format: value => $t(`data_${value}`) 
			}
		]
	},
	[SymbolTransactionType.NODE_KEY_LINK]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'linkedAccountAddress' },
		arrowCaptions: [
			{ 
				type: CaptionType.TEXT, 
				field: 'linkAction', 
				format: value => $t(`data_${value}`) 
			}
		]
	},
	[SymbolTransactionType.VOTING_KEY_LINK]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'linkedAccountAddress' },
		arrowCaptions: [
			{ 
				type: CaptionType.TEXT, 
				field: 'linkAction', 
				format: value => $t(`data_${value}`) 
			}
		]
	},
	[SymbolTransactionType.ACCOUNT_KEY_LINK]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'linkedAccountAddress' },
		arrowCaptions: [
			{ 
				type: CaptionType.TEXT, 
				field: 'linkAction', 
				format: value => $t(`data_${value}`) 
			}
		]
	},
	[SymbolTransactionType.HASH_LOCK]: {
		targetType: TransactionGraphicAvatarType.LOCK,
		targetFields: {
			valueFormat: tx => $t('transactionDescriptionShort_hashLock', { duration: tx.duration })
		},
		arrowCaptions: [
			{ 
				type: CaptionType.TEXT, 
				field: 'lockedAmount', 
				format: (amount, tx, options) => {
					return `${formatAmount(amount)} ${options.nativeCurrencyTicker}`;
				}
			}
		]
	},
	[SymbolTransactionType.SECRET_LOCK]: {
		targetType: TransactionGraphicAvatarType.LOCK,
		targetFields: {},
		arrowCaptions: [
			{ type: CaptionType.TEXT, field: 'secret' }
		]
	},
	[SymbolTransactionType.SECRET_PROOF]: {
		targetType: TransactionGraphicAvatarType.LOCK,
		targetFields: {},
		arrowCaptions: [
			{ type: CaptionType.TEXT, field: 'secret' }
		]
	},
	[SymbolTransactionType.ACCOUNT_METADATA]: {
		targetType: TransactionGraphicAvatarType.ACCOUNT,
		targetFields: { addressField: 'targetAddress' },
		arrowCaptions: [
			{ type: CaptionType.TEXT, field: 'scopedMetadataKey' }
		]
	},
	[SymbolTransactionType.NAMESPACE_METADATA]: {
		targetType: TransactionGraphicAvatarType.NAMESPACE,
		targetFields: { valueField: 'targetNamespaceId' },
		arrowCaptions: [
			{ type: CaptionType.TEXT, field: 'scopedMetadataKey' }
		]
	},
	[SymbolTransactionType.MOSAIC_METADATA]: {
		targetType: TransactionGraphicAvatarType.TOKEN,
		targetFields: { valueField: 'targetMosaicId' },
		arrowCaptions: [
			{ type: CaptionType.TEXT, field: 'scopedMetadataKey' }
		]
	}
};

/**
 * Options for creating transaction graphic data.
 * @typedef {object} TransactionGraphicOptions
 * @property {ChainName} chainName - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @property {NetworkIdentifier} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @property {string} nativeCurrencyTicker - The ticker symbol for the native currency.
 * @property {string} nativeCurrencyTokenId - The token ID for the native currency.
 * @property {WalletAccount[]} [walletAccounts] - The list of wallet accounts.
 * @property {object} [addressBook] - The address book instance.
 */

/**
 * Formats an amount value for display. Returns absolute value as string.
 * @param {string} [amount] - The amount value.
 * @returns {string} Formatted amount string.
 */
const formatAmount = amount => {
	if (typeof amount !== 'string')
		return '0';

	if (amount.startsWith('-'))
		return amount.substring(1);

	return amount;
};

/**
 * Creates the source side data from the transaction.
 * Source is always the transaction signer.
 * @param {Transaction} transaction - The transaction.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicSide} Source side data.
 */
const createSourceData = (transaction, options) => {
	const { chainName, networkIdentifier, walletAccounts, addressBook } = options;
	const address = transaction.signerAddress || '';
	const accountDisplayData = createAccountDisplayData(address, {
		chainName,
		networkIdentifier,
		walletAccounts,
		addressBook
	});

	return {
		type: TransactionGraphicAvatarType.ACCOUNT,
		text: accountDisplayData.name ?? address,
		accountAddress: address,
		imageId: accountDisplayData.imageId,
		color: accountDisplayData.color
	};
};

/**
 * Creates the target side data from the transaction using configuration.
 * @param {Transaction} transaction - The transaction.
 * @param {TransactionGraphicConfig} config - The graphic configuration.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicSide} Target side data.
 */
const createTargetData = (transaction, config, options) => {
	const { chainName, networkIdentifier, walletAccounts, addressBook } = options;
	const { targetType, targetFields } = config;
	const { addressField, valueField, valueFormat } = targetFields;

	// Handle account type targets
	if (targetType === TransactionGraphicAvatarType.ACCOUNT) {
		const address = addressField ? (transaction[addressField] || '') : '';
		const accountDisplayData = createAccountDisplayData(address, {
			chainName,
			networkIdentifier,
			walletAccounts,
			addressBook
		});

		return {
			type: targetType,
			text: accountDisplayData.name ?? address,
			accountAddress: address,
			imageId: accountDisplayData.imageId,
			color: accountDisplayData.color
		};
	}

	// Handle token type targets
	if (targetType === TransactionGraphicAvatarType.TOKEN) {
		const tokenId = valueField ? (transaction[valueField] || '') : '';
		const tokenDisplayData = createTokenDisplayData(
			{ id: tokenId },
			chainName,
			networkIdentifier
		);

		return {
			type: targetType,
			text: tokenDisplayData.name,
			imageId: tokenDisplayData.imageId
		};
	}

	// Handle namespace and lock types (no account/token display data needed)
	let text = '';

	if (valueFormat)
		text = valueFormat(transaction);
	else if (valueField)
		text = transaction[valueField] || '';

	return { type: targetType, text };
};

/**
 * Creates arrow captions from the transaction using configuration.
 * @param {Transaction} transaction - The transaction.
 * @param {ArrowCaptionConfig[]} captionConfigs - The caption configurations.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicArrowCaption[]} Arrow captions.
 */
const createArrowCaptions = (transaction, captionConfigs, options) => {
	if (!captionConfigs || captionConfigs.length === 0)
		return [];

	return captionConfigs
		.filter(captionConfig => {
			if (captionConfig.condition)
				return captionConfig.condition(transaction, options);

			return true;
		})
		.map(captionConfig => {
			if (captionConfig.type === 'icon') {
				return {
					type: CaptionType.ICON,
					value: captionConfig.icon
				};
			}

			// Text type
			let value = '';

			if (captionConfig.field)
				value = transaction[captionConfig.field];

			if (captionConfig.format)
				value = captionConfig.format(value, transaction, options);

			return {
				type: CaptionType.TEXT,
				value: value ?? ''
			};
		})
		.filter(caption => caption.value);
};

/**
 * Gets formatted type text for the transaction.
 * @param {Transaction} transaction - The transaction.
 * @param {TransactionGraphicConfig} [config] - The graphic configuration.
 * @returns {string} Formatted type text.
 */
const getTypeText = (transaction, config) => {
	let customKey;
	if (config?.typeTextKey)
		customKey = config.typeTextKey(transaction);

	if (customKey)
		return $t(customKey);

	return $t(`transactionDescriptor_${transaction.type}`);
};


/**
 * Creates the transaction graphic view model from transaction.
 * @param {Transaction} transaction - Transaction to convert into graphic display data.
 * @param {TransactionGraphicOptions} options - Options for creating the graphic data.
 * @returns {TransactionGraphicData} Transaction graphic data.
 */
export const createTransactionGraphicData = (transaction, options) => {
	const config = transactionGraphicConfigMap[transaction.type];
	const typeText = getTypeText(transaction, config);

	// Fallback for unsupported transaction types
	if (!config) {
		const sourceData = createSourceData(transaction, options);

		return {
			typeText,
			source: sourceData,
			target: {
				type: TransactionGraphicAvatarType.ACCOUNT,
				text: sourceData.text,
				accountAddress: sourceData.accountAddress,
				imageId: sourceData.imageId,
				color: sourceData.color
			},
			arrowCaptions: []
		};
	}

	return {
		typeText,
		source: createSourceData(transaction, options),
		target: createTargetData(transaction, config, options),
		arrowCaptions: createArrowCaptions(transaction, config.arrowCaptions, options)
	};
};
