import CustomImage from './CustomImage';
import { Dropdown } from './Dropdown';
import Field from './Field';
import Modal from './Modal';
import SearchBar from './SearchBar';
import TextBox from './TextBox';
import ValueAccount from './ValueAccount';
import { search } from '@/api/search';
import { BACKEND_HEALTH_ERROR, STORAGE_KEY } from '@/constants';
import styles from '@/styles/components/Header.module.scss';
import { createPageHref, formatDate, useStorage, useToggle } from '@/utils';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';
import { toast } from 'react-toastify';

const Header = ({ backendStatus }) => {
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
		},
		{
			text: t('menu_nodes'),
			href: createPageHref('nodes'),
			iconSrc: '/images/menu/nodes.svg'
		}
	];
	const languages = [
		{
			value: 'en',
			label: 'English'
		},
		{
			value: 'ja',
			label: '日本語'
		},
		{
			value: 'isv',
			label: 'Medžuslovjansky'
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
					<CustomImage src={item.iconSrc + ''} className={styles.menuIcon} alt={item.text} />
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
		const normalizedAddress = address.replace(/-/g, '').trim().toUpperCase();

		if (!/^[A-Z2-7]{40}$/.test(normalizedAddress))
			return toast.error(t('message_addressBook_incorrectAddress'));
		if (name.length === 0)
			return toast.error(t('message_addressBook_nameEmpty'));
		if (name.length > 15)
			return toast.error(t('message_addressBook_nameTooLong'));
		if (contacts.some(userAddress => userAddress.address === normalizedAddress))
			return toast.error(t('message_addressBook_addressAlreadyAdded'));
		if (contacts.some(userAddress => userAddress.name === name))
			return toast.error(t('message_addressBook_nameAlreadyAdded'));

		setContacts([...contacts, { address: normalizedAddress, name }]);
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

	// Backend health warning
	const isBackendWarningShown = backendStatus?.isHealthy === false;
	const getBackendErrorStatusText = () => {
		const backendSyncError = backendStatus.errors.find(error => error.type === BACKEND_HEALTH_ERROR.SYNCHRONIZATION);

		// If error is not a sync error, return a generic error message
		if (!backendSyncError)
			return t('message_healthGenericError');

		const lastSyncedAtDateText = formatDate(backendStatus.lastDBSyncedAt, t, {
			type: 'local',
			hasTime: true,
			hasSeconds: true
		});

		return t('message_healthSyncError', {
			lastSyncedAt: lastSyncedAtDateText,
			lastBlockHeight: backendStatus.lastDBHeight
		});
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
								<h4>{t('section_language')}</h4>
								<Dropdown options={languages} value={userLanguage} onChange={selectLanguage} />
							</div>
							<div>
								<h4>{t('section_currency')}</h4>
								<Dropdown options={currencies} value={userCurrency} onChange={setUserCurrency} />
							</div>
							<div>
								<h4>{t('section_addressBook')}</h4>
								{t('section_addressBook_description')}
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
													alt={t('button_remove')}
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
							<CustomImage src="/images/icon-account-add.png" className={styles.buttonAddIcon} alt={t('button_add')} />
						</div>
					)}
					{isAddContactOpen && (
						<div className="layout-flex-col-fields">
							<Field title={t('field_address')}>
								<TextBox value={address} onChange={setAddress} />
							</Field>
							<Field title={t('field_name')}>
								<TextBox value={name} onChange={setName} />
							</Field>
							<div className="layout-flex-row">
								<div className={styles.button} onClick={addAddress}>
									{t('button_add')}
								</div>
								<div className={styles.button} onClick={dismissNewContact}>
									{t('button_cancel')}
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
				{isBackendWarningShown && (
					<div className={styles.backendStatus}>
						<div className={styles.backendStatusText}>
							{getBackendErrorStatusText()}
						</div>
					</div>
				)}
			</header>
			<nav className={styles.mobileMenu}>{renderMenu()}</nav>
		</div>
	);
};

export default Header;
