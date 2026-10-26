import { HarvestingHomeWidget } from '../screens/harvesting/widgets/HarvestingHomeWidget';
import { MultisigHomeWidget } from '../screens/multisig/widgets/MultisigHomeWidget';
import { AddressBookHomeWidget } from '@/app/screens/address-book/widgets/AddressBookHomeWidget';

/** @typedef {import('@/app/screens/home/types/Home').HomeScreenConfig} HomeScreenConfig */

/** @type {HomeScreenConfig} */
export const homeScreenConfig = {
	widgets: [
		{ id: 'addressBook', Component: AddressBookHomeWidget },
		{ id: 'multisig', Component: MultisigHomeWidget },
		{ id: 'harvesting', Component: HarvestingHomeWidget }
	]
};
