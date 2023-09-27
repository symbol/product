import Avatar from './Avatar';
import ValueMosaic from './ValueMosaic';
import ValueTransactionType from './ValueTransactionType';
import styles from '@/styles/components/ValueTransaction.module.scss';
import { createPageHref, trunc } from '@/utils';
import Link from 'next/link';

const ValueTransaction = ({ value, type, amount, isNavigationDisabled, onClick }) => {
	const handleClick = e => {
		e.stopPropagation();
		if (!onClick) return;
		if (isNavigationDisabled) e.preventDefault();
		onClick(value);
	};

	return (
		<Link className={styles.valueTransaction} href={createPageHref('transactions', value)} onClick={handleClick}>
			<Avatar type="transaction" value={type} size="md" />
			<div>
				<ValueTransactionType hideIcon value={type} />
				{trunc(value, 'hash')}
			</div>
			<div className={styles.sectionAmount}>
				<ValueMosaic isNative amount={amount} />
			</div>
		</Link>
	);
};

export default ValueTransaction;
