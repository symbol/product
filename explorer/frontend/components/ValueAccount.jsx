import Avatar from '@/app/components/Avatar';
import ButtonCopy from '@/app/components/ButtonCopy';
import { STORAGE_KEY } from '@/app/constants';
import styles from '@/app/styles/components/ValueAccount.module.scss';
import { createPageHref, handleNavigationItemClick, truncateString, useStorage } from '@/app/utils';
import Link from 'next/link';
import { useState } from 'react';

const ValueAccount = ({ address, size, raw, position, className, isNavigationDisabled, isCopyDisabled, isWrapDisabled, onClick }) => {
	const [name, setName] = useState();
	useStorage(STORAGE_KEY.ADDRESS_BOOK, [], addressBook => {
		const name = addressBook.find(item => item.address === address)?.name;
		setName(name);
	});
	let containerStyle = '';
	const textStyle = size === 'md' ? (isWrapDisabled ? styles.textMdNoWrap : styles.textMd) : '';
	const displayedText = !raw && name ? `${name} (${truncateString(address, 'address-short')})` : address;

	switch (position) {
	case 'left':
		containerStyle = styles.containerLeft;
		break;
	case 'right':
		containerStyle = styles.containerRight;
		break;
	}

	const handleClick = e => {
		handleNavigationItemClick(e, onClick, address, isNavigationDisabled);
	};

	return (
		<div className={`${styles.valueAccount} ${containerStyle} ${className}`}>
			{!address && '-'}
			{!!address && (
				<>
					<Avatar type="account" value={address} size={size} />
					<div className={styles.addressContainer}>
						<Link className={textStyle} href={createPageHref('accounts', address)} onClick={handleClick}>
							{displayedText}
						</Link>
						{!isCopyDisabled && <ButtonCopy value={address} />}
					</div>
				</>
			)}
		</div>
	);
};

export default ValueAccount;
