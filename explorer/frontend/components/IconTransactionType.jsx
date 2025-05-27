import CustomImage from './CustomImage';
import { TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/components/IconTransactionType.module.scss';
import { createAssetURL } from '@/utils';

const iconTypeMap = {
	[TRANSACTION_TYPE.TRANSFER]: createAssetURL('/images/transaction/transfer.svg'),
	[TRANSACTION_TYPE.MOSAIC_CREATION]: createAssetURL('/images/transaction/mosaic-creation.svg'),
	[TRANSACTION_TYPE.MOSAIC_SUPPLY_CHANGE]: createAssetURL('/images/transaction/mosaic.svg'),
	[TRANSACTION_TYPE.NAMESPACE_REGISTRATION]: createAssetURL('/images/transaction/namespace.svg'),
	[TRANSACTION_TYPE.MULTISIG_ACCOUNT_MODIFICATION]: createAssetURL('/images/transaction/account-multisig.svg'),
	[TRANSACTION_TYPE.ACCOUNT_KEY_LINK]: createAssetURL('/images/transaction/key.svg'),
	[TRANSACTION_TYPE.MULTISIG]: createAssetURL('/images/transaction/aggregate.svg')
};

const IconTransactionType = ({ value, className, style }) => {
	return <CustomImage src={iconTypeMap[value]} className={`${styles.iconTransactionType} ${className}`} style={style} alt={value} />;
};

export default IconTransactionType;
