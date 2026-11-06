import { AddressBookHomeWidget } from '@/app/screens/address-book/widgets/AddressBookHomeWidget';

/** @typedef {import('@/contract/types/Config').HomeScreenConfig} HomeScreenConfig */

/** @type {HomeScreenConfig} */
export const homeScreenConfig = {
	widgets: [
		{ id: 'addressBook', Component: AddressBookHomeWidget }
	]
};
