import CustomImage from './CustomImage';
import { TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/components/IconTransactionType.module.scss';

const iconTypeMap = {
	[TRANSACTION_TYPE.ACCOUNT_ADDRESS_RESTRICTION]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.TRANSFER]: '/images/transaction/transfer.svg',
	[TRANSACTION_TYPE.ACCOUNT_KEY_LINK]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.ACCOUNT_METADATA]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.ACCOUNT_MOSAIC_RESTRICTION]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.ACCOUNT_OPERATION_RESTRICTION]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.ADDRESS_ALIAS]: '/images/transaction/namespace.svg',
	[TRANSACTION_TYPE.AGGREGATE_BONDED]: '/images/transaction/aggregate.svg',
	[TRANSACTION_TYPE.AGGREGATE_COMPLETE]: '/images/transaction/aggregate.svg',
	[TRANSACTION_TYPE.HASH_LOCK]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.MOSAIC_ADDRESS_RESTRICTION]: '/images/transaction/mosaic.svg',
	[TRANSACTION_TYPE.MOSAIC_ALIAS]: '/images/transaction/mosaic.svg',
	[TRANSACTION_TYPE.MOSAIC_CREATION]: '/images/transaction/mosaic-creation.svg',
	[TRANSACTION_TYPE.MOSAIC_GLOBAL_RESTRICTION]: '/images/transaction/mosaic.svg',
	[TRANSACTION_TYPE.MOSAIC_METADATA]: '/images/transaction/mosaic.svg',
	[TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE]: '/images/transaction/mosaic.svg',
	[TRANSACTION_TYPE.MOSAIC_SUPPLY_REVOCATION]: '/images/transaction/mosaic.svg',
	[TRANSACTION_TYPE.NAMESPACE_REGISTRATION]: '/images/transaction/namespace.svg',
	[TRANSACTION_TYPE.NAMESPACE_METADATA]: '/images/transaction/namespace.svg',
	[TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION]: '/images/transaction/account-multisig.svg',
	[TRANSACTION_TYPE.MULTISIG]: '/images/transaction/aggregate.svg',
	[TRANSACTION_TYPE.NODE_KEY_LINK]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.SECRET_LOCK]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.SECRET_PROOF]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.VOTING_KEY_LINK]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.VRF_KEY_LINK]: '/images/transaction/key.svg'
};

const IconTransactionType = ({ value, className, style }) => {
	return (
		<CustomImage
			src={iconTypeMap[value] || iconTypeMap[TRANSACTION_TYPE.TRANSFER]}
			className={`${styles.iconTransactionType} ${className}`}
			style={style}
			alt={value}
		/>
	);
};

export default IconTransactionType;
