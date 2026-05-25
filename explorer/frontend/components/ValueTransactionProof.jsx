import styles from '@/styles/components/ValueTransactionProof.module.scss';

const ValueTransactionProof = ({ proof }) => {
	if (!proof)
		return null;

	return <span className={styles.valueTransactionProof}>{proof}</span>;
};

export default ValueTransactionProof;
