import { $t } from '@/app/localization';
import { ContactListType } from '@/app/screens/address-book/types/AddressBook';

export const createContactListTypeTabs = () => [
	{ 
		value: ContactListType.WHITELIST, 
		label: $t('s_addressBook_tab_whitelist') 
	},
	{ 
		value: ContactListType.BLACKLIST, 
		label: $t('s_addressBook_tab_blacklist') 
	}
];
