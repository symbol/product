import { AddressBookWidget } from './AddressBookWidget';
import { WidgetAnimatedWrapper } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { useAddressBookWidget } from '@/app/screens/address-book/hooks/useAddressBookWidget';
import React from 'react';

/**
 * AddressBookHomeWidget component. A self-contained address-book widget for the Home screen:
 * it loads its own data and is always shown.
 * @returns {React.ReactNode} AddressBookHomeWidget component.
 */
export const AddressBookHomeWidget = () => {
	const walletController = useWalletController();
	const addressBookWidget = useAddressBookWidget(walletController);

	return (
		<WidgetAnimatedWrapper isVisible={addressBookWidget.isVisible}>
			<AddressBookWidget contacts={addressBookWidget.props.contacts} />
		</WidgetAnimatedWrapper>
	);
};
