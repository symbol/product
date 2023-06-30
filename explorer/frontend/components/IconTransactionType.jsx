import CustomImage from './CustomImage';
import styles from '@/styles/components/IconTransactionType.module.scss';

const iconTypeMap = {
	transfer: '/images/transaction/transfer.svg'
};

const IconTransactionType = ({ value, className }) => {
	return <CustomImage src={iconTypeMap[value]} className={`${styles.iconTransactionType} ${className}`} alt={value} />;
};

export default IconTransactionType;
