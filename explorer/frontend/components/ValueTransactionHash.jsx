import ButtonCopy from '@/components/ButtonCopy';
import styles from '@/styles/components/ValueTransactionHash.module.scss';
import { trunc } from '@/utils';

const ValueTransactionHash = ({ value }) => {
	return (
		<div className={styles.valueTransactionHash}>
			<div className={styles.text}>{trunc(value, 'hash')}</div>
			<ButtonCopy value={value} />
		</div>
	);
};

export default ValueTransactionHash;
