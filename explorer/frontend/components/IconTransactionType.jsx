import CustomImage from './CustomImage';
import { TRANSACTION_TYPE } from '@/constants';
import styles from '@/styles/components/IconTransactionType.module.scss';

const iconTypeMap = {
	[TRANSACTION_TYPE.TRANSFER]: '/images/transaction/transfer.svg',
	[TRANSACTION_TYPE.MOSAIC_CREATION]: '/images/transaction/mosaic-creation.svg',
	[TRANSACTION_TYPE.AGGREGATE]: '/images/transaction/aggregate.svg'
};

const IconTransactionType = ({ value, className, style }) => {
	return <CustomImage src={iconTypeMap[value]} className={`${styles.iconTransactionType} ${className}`} style={style} alt={value} />;
};

export default IconTransactionType;
