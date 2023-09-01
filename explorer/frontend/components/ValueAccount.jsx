import Avatar from '@/components/Avatar';
import ButtonCopy from '@/components/ButtonCopy';
import { EVENT } from '@/constants';
import styles from '@/styles/components/ValueAccount.module.scss';
import { getContactsFromStorage, trunc } from '@/utils';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const ValueAccount = ({ address, size, raw, position, className, onClick }) => {
	const [name, setName] = useState();
	let containerStyle = '';
	const textStyle = size === 'md' ? styles.textMd : '';
	const displayedText = !raw && name ? `${name} (${trunc(address, 'address')})` : address;

	switch (position) {
		case 'left':
			containerStyle = styles.containerLeft;
			break;
		case 'right':
			containerStyle = styles.containerRight;
			break;
	}

	const handleClick = e => {
		if (!onClick) return;
		e.preventDefault();
		onClick();
	};
	const updateName = () => {
		const userAddresses = getContactsFromStorage();
		const name = userAddresses.find(item => item.address === address)?.name;
		setName(name);
	};

	useEffect(() => {
		updateName();
		window?.addEventListener(EVENT.ADDRESS_BOOK_UPDATE, updateName);

		return () => {
			window?.removeEventListener(EVENT.ADDRESS_BOOK_UPDATE, updateName);
		};
	}, []);

	return (
		<div className={`${styles.valueAccount} ${containerStyle} ${className}`}>
			<Avatar type="account" value={address} size={size} />
			<div className={styles.addressContainer}>
				<Link className={textStyle} href={`/accounts/${address}`} onClick={handleClick}>
					{displayedText}
				</Link>
				<ButtonCopy value={address} />
			</div>
		</div>
	);
};

export default ValueAccount;
