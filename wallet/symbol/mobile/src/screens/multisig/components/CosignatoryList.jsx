import { AccountView, ActionRow, ButtonCircle, Stack } from '@/app/components';
import { createAccountDisplayData } from '@/app/utils';
import React from 'react';
import { View } from 'react-native';

/** @typedef {import('@/app/screens/multisig/types/Multisig').Cosignatory} Cosignatory */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */

/**
 * CosignatoryList component. Displays a list of cosignatory accounts with optional
 * remove functionality for editing mode.
 *
 * @param {Object} props - Component props.
 * @param {boolean} [props.isEditable=false] - Whether to show remove buttons.
 * @param {(address: Cosignatory) => void} [props.onRemove] - Callback when a cosignatory is removed.
 * @param {Cosignatory[]} props.cosignatories - List of cosignatory addresses.
 * @param {string} props.chainName - The blockchain name.
 * @param {NetworkIdentifier} props.networkIdentifier - The network identifier.
 * @param {WalletAccount[]} [props.walletAccounts] - The wallet accounts for display names.
 * @param {Object} [props.addressBook] - The address book for display names.
 * @returns {React.ReactNode} CosignatoryList component.
 */
export const CosignatoryList = ({
	isEditable = false,
	onRemove,
	cosignatories,
	chainName,
	networkIdentifier,
	walletAccounts,
	addressBook
}) => {
	const handleRemovePress = address => {
		if (isEditable && onRemove)
			onRemove(address);
	};

	return (
		<Stack gap="s">
			{cosignatories.map(address => {
				const accountDisplay = createAccountDisplayData(address, {
					walletAccounts,
					addressBook,
					chainName,
					networkIdentifier
				});

				return (
					<View key={address}>
						<ActionRow
							isStretched
							button={isEditable && (
								<ButtonCircle
									size="m"
									icon="delete"
									onPress={() => handleRemovePress(address)}
								/>
							)}
						>
							<AccountView
								address={address}
								name={accountDisplay.name}
								size="m"
							/>
						</ActionRow>
					</View>
				);
			})}
		</Stack>
	);
};
