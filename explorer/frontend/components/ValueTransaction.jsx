import Avatar from './Avatar';
import ValueMosaic from './ValueMosaic';
import ValueTransactionType from './ValueTransactionType';
import styles from '@/styles/components/ValueTransaction.module.scss';
import { createPageHref, handleNavigationItemClick, truncateString } from '@/utils';
import Link from 'next/link';

const ValueTransaction = ({ value, type, amount, isNavigationDisabled, onClick }) => {
	const handleClick = e => {
		handleNavigationItemClick(e, onClick, value, isNavigationDisabled);
	};

	return (
		<Link className={styles.valueTransaction} href={createPageHref('transactions', value)} onClick={handleClick}>
			<Avatar type="transaction" value={type} size="md" />
			<div>
				<ValueTransactionType hideIcon value={type} />
				{truncateString(value, 'hash')}
			</div>
			<div className={styles.sectionAmount}>
				<ValueMosaic isNative amount={amount} />
			</div>
		</Link>
	);
};

export default ValueTransaction;
