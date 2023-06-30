import AccountAvatar from '@/components/AccountAvatar';
import ButtonCopy from '@/components/ButtonCopy';
import styles from '@/styles/components/ValueAccount.module.scss';

const ValueAccount = ({ address, size }) => {
	const extendedStyle = size === 'md' ? styles.containerMd : '';

	return (
		<div className={styles.valueAccount}>
			<AccountAvatar address={address} size={size} />
			<div className={extendedStyle}>{address}</div>
			<ButtonCopy value={address} />
		</div>
	);
};

export default ValueAccount;
