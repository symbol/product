import { AccountBalanceRow, Dropdown } from '@/app/components';
import { useAccountDisplayData } from '@/app/hooks';
import React from 'react';

/** @typedef {import('wallet-common-symbol/src/types/Mosaic').MosaicOwner} MosaicOwner */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * SelectSourceAccount component. A dropdown for choosing the holder account a mosaic is revoked from,
 * listing each holder with its resolved name, address and held amount.
 * @param {object} props - Component props.
 * @param {string} props.label - Dropdown label.
 * @param {string} props.value - Currently selected holder address.
 * @param {MosaicOwner[]} props.owners - The mosaic holders to choose from.
 * @param {ChainName} [props.chainName] - The chain the holders belong to. Defaults to the main chain.
 * @param {function(string): void} props.onChange - Callback when the selected holder changes.
 * @returns {React.ReactNode} SelectSourceAccount component.
 */
export const SelectSourceAccount = props => {
	const { label, value, owners, chainName, onChange } = props;
	const ownersDisplayData = useAccountDisplayData(owners.map(owner => owner.address), chainName);

	const list = owners.map((owner, index) => {
		const accountName = ownersDisplayData[index].name;

		return {
			value: owner.address,
			label: accountName ?? owner.address,
			name: accountName,
			amount: owner.amount
		};
	});

	const renderItem = ({ item }) => (
		<AccountBalanceRow
			address={item.value}
			name={item.name}
			amount={item.amount}
		/>
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
