import CustomImage from './CustomImage';
import Field from './Field';
import Modal from './Modal';
import SearchBar from './SearchBar';
import TextBox from './TextBox';
import ValueAccount from './ValueAccount';
import { STORAGE_KEY } from '@/constants';
import { search } from '@/pages/api/search';
import styles from '@/styles/components/Header.module.scss';
import { useStorage, useToggle } from '@/utils';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';
import { toast } from 'react-toastify';

const Header = () => {
	const router = useRouter();
	const { t } = useTranslation();
	const [contacts, setContacts] = useStorage(STORAGE_KEY.ADDRESS_BOOK, []);
	const [address, setAddress] = useState('');
	const [name, setName] = useState('');
	const [isProfileOpen, toggleProfile] = useToggle(false);
	const [isMenuOpen, toggleMenu] = useToggle(false);
	const [isAddContactOpen, toggleAddContact] = useToggle(false);
	const menuItems = [
		{
			text: t('menu_home'),
			href: '/'
		},
		{
			text: t('menu_blocks'),
			href: '/blocks'
		},
		{
			text: t('menu_accounts'),
			href: '/accounts'
		},
		{
			text: t('menu_transactions'),
			href: '/transactions'
		}
	];
	const languages = [
		{
			locale: 'en',
			title: 'English'
		},
		{
			locale: 'uk',
			title: 'Українська'
		}
	];

	const renderMenu = () => (
		<>
			{menuItems.map((item, index) => (
				<Link className={getItemStyle(item.href)} key={index} href={item.href}>
					{item.text}
				</Link>
			))}
		</>
	);
	const getItemStyle = href => `${styles.menuItem} ${router.asPath === href && styles.menuItem__active}`;
	const removeContact = contact => {
		const updatedContacts = contacts.filter(item => item.address !== contact.address);
		setContacts(updatedContacts);
	};
	const addAddress = () => {
		if (address.length < 40) {
			return toast.error('Incorrect address');
		}
		if (name.length === 0) {
			return toast.error('Name should not be empty');
		}
		if (name.length > 15) {
			return toast.error('Name should be up to 15 characters');
		}
		if (contacts.some(userAddress => userAddress.address === address)) {
			return toast.error('Address already added');
		}
		if (contacts.some(userAddress => userAddress.name === name)) {
			return toast.error('Address with such Name already added');
		}

		setContacts([...contacts, { address, name }]);
		setAddress('');
		setName('');
		toggleAddContact();
	};
	const dismissNewContact = () => {
		setAddress('');
		setName('');
		toggleAddContact();
	};

	return (
		<div className={styles.headerWrapper}>
			<header className={styles.header}>
				<div className={styles.headerLogo}>
					<Image src="/images/logo-nem.png" fill alt="NEM" />
				</div>

				<div className={styles.headerRightSection}>
					<div className={styles.headerMenu}>{renderMenu()}</div>
					<SearchBar className={styles.searchBar} modalClassName={styles.modal} onSearchRequest={search} />
					<CustomImage className={styles.profileIcon} src="/images/icon-profile.svg" alt="profile" onClick={toggleProfile} />
					<CustomImage className={styles.menuIcon} src="/images/icon-menu.svg" alt="profile" onClick={toggleMenu} />
				</div>
				<Modal className={`${styles.modal} ${styles.modalProfile}`} isVisible={isProfileOpen} onClose={toggleProfile}>
					<div className="layout-flex-col">
						<div>
							<h4>Language</h4>
							<div className={styles.modalCompactList}>
								{languages.map(item => (
									<Link href="/" locale={item.locale} key={'locale' + item.locale} onClick={toggleProfile}>
										{item.title}
									</Link>
								))}
							</div>
						</div>
						<div>
							<h4>Address Book</h4>
							Give accounts names to easily identify them through the explorer.
						</div>
					</div>
					{!isAddContactOpen && (
						<div className={styles.contactList}>
							{contacts.map((item, index) => (
								<div className={styles.profileAddress} key={index}>
									<Field title={item.name}>
										<div className="layout-flex-row">
											<ValueAccount address={item.address} raw size="md" />
											<CustomImage
												src="/images/icon-delete.png"
												className={styles.buttonRemove}
												alt="Remove"
												onClick={() => removeContact(item)}
											/>
										</div>
									</Field>
								</div>
							))}
						</div>
					)}
					{!isAddContactOpen && (
						<div className={styles.buttonAddContainer} onClick={toggleAddContact}>
							<CustomImage src="/images/icon-account-add.png" className={styles.buttonAddIcon} alt="Add" />
						</div>
					)}
					{isAddContactOpen && (
						<div className="layout-flex-col-fields">
							<Field title="Address">
								<TextBox value={address} onChange={setAddress} />
							</Field>
							<Field title="Name">
								<TextBox value={name} onChange={setName} />
							</Field>
							<div className="layout-flex-row">
								<div className={styles.button} onClick={addAddress}>
									Add
								</div>
								<div className={styles.button} onClick={dismissNewContact}>
									Cancel
								</div>
							</div>
						</div>
					)}
				</Modal>
				<Modal className={styles.modal} isVisible={isMenuOpen} onClose={toggleMenu}>
					<div className={styles.mobileMenu} onClick={toggleMenu}>
						{renderMenu()}
					</div>
				</Modal>
			</header>
		</div>
	);
};

export default Header;
