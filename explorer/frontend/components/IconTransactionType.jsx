import CustomImage from './CustomImage';
import styles from '@/app/styles/components/IconTransactionType.module.scss';
import { createAssetURL } from '@/app/utils';
import { getTransactionTypeInfo } from '@/variant/transaction/transaction-types';

const IconTransactionType = ({ value, className, style }) => {
	const { icon } = getTransactionTypeInfo(value);
	const src = createAssetURL(`/images/transaction/${icon}.svg`);

	return <CustomImage src={src} className={`${styles.iconTransactionType} ${className}`} style={style} alt={value} />;
};

export default IconTransactionType;
