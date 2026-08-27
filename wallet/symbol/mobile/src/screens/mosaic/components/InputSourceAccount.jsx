import { AccountBalanceRow, InputAddress } from '@/app/components';
import { validateNotSenderAddress } from '@/app/screens/mosaic/utils';
import { validateAddress } from '@/app/utils';
import React from 'react';

/** @typedef {import('wallet-common-symbol/src/types/Mosaic').MosaicOwner} MosaicOwner */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * InputSourceAccount component. Address field for the holder account a mosaic is revoked from. The
 * user types an address or picks a holder, each listed with its resolved name, address and held amount.
 * @param {object} props - Component props.
 * @param {string} props.label - Field label; also the holder picker title.
 * @param {string} props.value - Current holder address.
 * @param {MosaicOwner[]} props.owners - The mosaic holders offered in the picker.
 * @param {string} props.senderAddress - The address the revocation is sent from, rejected as a holder.
 * @param {ChainName} props.chainName - The chain the holders belong to.
 * @param {boolean} [props.isDisabled] - Whether the input is disabled, hiding validation errors.
 * @param {function(string): void} props.onChange - Callback when the holder address changes.
 * @param {function(boolean): void} props.onValidityChange - Callback when the address validity changes.
 * @returns {React.ReactNode} InputSourceAccount component.
 */
export const InputSourceAccount = props => {
	const { label, value, owners, senderAddress, chainName, isDisabled, onChange, onValidityChange } = props;
	const validators = [validateAddress(chainName), validateNotSenderAddress(senderAddress)];

	const renderHolderRow = ({ item, accountDisplayData }) => (
		<AccountBalanceRow
			address={item.address}
			name={accountDisplayData.name}
			amount={item.amount}
		/>
	);

	return (
		<InputAddress
			label={label}
			value={value}
			options={owners}
			chainName={chainName}
			isDisabled={isDisabled}
			extraValidators={validators}
			renderItem={renderHolderRow}
			onChange={onChange}
			onValidityChange={onValidityChange}
		/>
	);
};
