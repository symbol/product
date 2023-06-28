import styles from '@/styles/components/IconTransactionType.module.scss';
import Image from 'next/image';

const iconTypeMap = {
	transfer: '/images/transaction/transfer.svg'
};

const IconTransactionType = ({ value, className }) => {
	return (
		<div className={`${styles.iconTransactionType} ${className}`}>
			<Image src={iconTypeMap[value]} fill/>
		</div>
	);
};

export default IconTransactionType;
