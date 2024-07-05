import CustomImage from './CustomImage';
import { TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/components/IconTransactionType.module.scss';

const iconTypeMap = {
	[TRANSACTION_TYPE.TRANSFER]: '/images/transaction/transfer.svg',
	[TRANSACTION_TYPE.MOSAIC_CREATION]: '/images/transaction/mosaic-creation.svg',
	[TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE]: '/images/transaction/mosaic.svg',
	[TRANSACTION_TYPE.NAMESPACE_REGISTRATION]: '/images/transaction/namespace.svg',
	[TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION]: '/images/transaction/account-multisig.svg',
	[TRANSACTION_TYPE.ACCOUNT_KEY_LINK]: '/images/transaction/key.svg',
	[TRANSACTION_TYPE.MULTISIG]: '/images/transaction/aggregate.svg'
};

const IconTransactionType = ({ value, className, style }) => {
	return <CustomImage src={iconTypeMap[value]} className={`${styles.iconTransactionType} ${className}`} style={style} alt={value} />;
};

export default IconTransactionType;
