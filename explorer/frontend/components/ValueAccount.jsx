import Avatar from '@/components/Avatar';
import ButtonCopy from '@/components/ButtonCopy';
import styles from '@/styles/components/ValueAccount.module.scss';
import Link from 'next/link';

const ValueAccount = ({ address, size, onClick }) => {
	const extendedStyle = size === 'md' ? styles.containerMd : '';

	const handleClick = (e) => {
		if (!onClick) return;
		e.preventDefault();
		onClick();
	}

	return (
		<div className={styles.valueAccount}>
			<Avatar type="account" value={address} size={size} />
			<Link className={extendedStyle} href={`/accounts/${address}`} onClick={handleClick}>{address}</Link>
			<ButtonCopy value={address} />
		</div>
	);
};

export default ValueAccount;
