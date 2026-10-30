import { AddressBookHomeWidget } from '@/app/screens/address-book/widgets/AddressBookHomeWidget';

/** @typedef {import('@/app/screens/home/types/Home').HomeScreenConfig} HomeScreenConfig */

/** @type {HomeScreenConfig} */
export const homeScreenConfig = {
	widgets: [
		{ id: 'addressBook', Component: AddressBookHomeWidget }
	]
};
