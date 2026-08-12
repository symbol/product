import { AccountView, Amount, Dropdown } from '@/app/components';
import { Sizes } from '@/app/styles';
import { createAccountDisplayData } from '@/app/utils';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('wallet-common-symbol/src/types/Mosaic').MosaicOwner} MosaicOwner */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * SelectSourceAccount component. A dropdown for choosing the holder account a mosaic is revoked from,
 * listing each holder with its resolved name, address and held amount.
 * @param {object} props - Component props.
 * @param {string} props.label - Dropdown label.
 * @param {string} props.value - Currently selected holder address.
 * @param {MosaicOwner[]} props.owners - The mosaic holders to choose from.
 * @param {WalletAccount[]} [props.walletAccounts] - The wallet accounts for display names.
 * @param {object} [props.addressBook] - The address book for display names.
 * @param {ChainName} props.chainName - Current chain name.
 * @param {NetworkIdentifier} props.networkIdentifier - Current network identifier.
 * @param {function(string): void} props.onChange - Callback when the selected holder changes.
 * @returns {React.ReactNode} SelectSourceAccount component.
 */
export const SelectSourceAccount = props => {
	const { label, value, owners, walletAccounts, addressBook, chainName, networkIdentifier, onChange } = props;

	const displayContext = { 
		walletAccounts, 
		addressBook, 
		chainName, 
		networkIdentifier 
	};
	const list = owners.map(owner => {
		const accountName = createAccountDisplayData(owner.address, displayContext).name;

		return {
			value: owner.address,
			label: accountName ?? owner.address,
			name: accountName,
			amount: owner.amount
		};
	});

	const renderItem = ({ item }) => (
		<View style={styles.item}>
			<AccountView
				address={item.value}
				name={item.name}
			/>
			<Amount
				value={item.amount}
				style={styles.amount}
			/>
		</View>
	);

	return (
		<Dropdown
			label={label}
			value={value}
			list={list}
			onChange={onChange}
			renderItem={renderItem}
		/>
	);
};

const styles = StyleSheet.create({
	item: {
		flex: 1,
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: Sizes.Semantic.layoutSpacing.l
	},
	amount: {
		alignSelf: 'flex-end'
	}
});
