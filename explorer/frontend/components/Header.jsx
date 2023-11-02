import CustomImage from './CustomImage';
import { Dropdown } from './Dropdown';
import Field from './Field';
import Modal from './Modal';
import SearchBar from './SearchBar';
import TextBox from './TextBox';
import ValueAccount from './ValueAccount';
import { search } from '@/api/search';
import { STORAGE_KEY } from '@/constants';
import styles from '@/styles/components/Header.module.scss';
import { createPageHref, useStorage, useToggle } from '@/utils';
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
	const [userLanguage, setUserLanguage] = useStorage(STORAGE_KEY.USER_LANGUAGE, 'en');
	const [userCurrency, setUserCurrency] = useStorage(STORAGE_KEY.USER_CURRENCY, 'USD');
	const [address, setAddress] = useState('');
	const [name, setName] = useState('');
	const [isProfileOpen, toggleProfile] = useToggle(false);
	const [isMenuOpen, toggleMenu] = useToggle(false);
	const [isAddContactOpen, toggleAddContact] = useToggle(false);
	const menuItems = [
		{
			text: t('menu_home'),
			href: createPageHref('home'),
			iconSrc: '/images/menu/home.svg'
		},
		{
			text: t('menu_blocks'),
			href: createPageHref('blocks'),
			iconSrc: '/images/menu/blocks.svg'
		},
		{
			text: t('menu_accounts'),
			href: createPageHref('accounts'),
			iconSrc: '/images/menu/accounts.svg'
		},
		{
			text: t('menu_transactions'),
			href: createPageHref('transactions'),
			iconSrc: '/images/menu/transactions.svg'
		},
		{
			text: t('menu_mosaics'),
			href: createPageHref('mosaics'),
			iconSrc: '/images/menu/mosaics.svg'
		},
		{
			text: t('menu_namespaces'),
			href: createPageHref('namespaces'),
			iconSrc: '/images/menu/namespaces.svg'
		}
	];
	const languages = [
		{
			value: 'en',
			label: 'English'
		},
		{
			value: 'uk',
			label: 'Українська'
		}
	];
	const currencies = [
		{
			value: 'USD',
			label: 'USD'
		},
		{
			value: 'EUR',
			label: 'EUR'
		},
		{
			value: 'UAH',
			label: 'UAH'
		},
		{
			value: 'GBP',
			label: 'GBP'
		},
		{
			value: 'JPY',
			label: 'JPY'
		}
	];

	const renderMenu = () => (
		<>
			{menuItems.map((item, index) => (
				<Link className={getItemStyle(item.href)} key={index} href={item.href}>
					<CustomImage src={item.iconSrc + ''} className={styles.menuIcon} />
					<div className={styles.menuText}>{item.text}</div>
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
	const selectLanguage = locale => {
		setUserLanguage(locale);
		toggleProfile();
	};

	return (
		<div className={styles.headerWrapper}>
			<header className={styles.header}>
				<div className={styles.headerLogo}>
					<Image src="/images/logo-nem.png" fill alt="Logo" />
				</div>

				<div className={styles.headerRightSection}>
					<div className={styles.headerMenu}>{renderMenu()}</div>
					<SearchBar className={styles.searchBar} modalClassName={styles.modal} onSearchRequest={search} />
					<CustomImage className={styles.profileIcon} src="/images/icon-profile.svg" alt="profile" onClick={toggleProfile} />
				</div>
				<Modal className={`${styles.modal} ${styles.modalProfile}`} isVisible={isProfileOpen} onClose={toggleProfile}>
					{!isAddContactOpen && (
						<div className="layout-flex-col">
							<div>
								<h4>Language</h4>
								<Dropdown options={languages} value={userLanguage} onChange={selectLanguage} />
							</div>
							<div>
								<h4>Currency</h4>
								<Dropdown options={currencies} value={userCurrency} onChange={setUserCurrency} />
							</div>
							<div>
								<h4>Address Book</h4>
								Give accounts names to easily identify them through the explorer.
							</div>
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
			<nav className={styles.mobileMenu}>{renderMenu()}</nav>
		</div>
	);
};

export default Header;
