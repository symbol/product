import { AccountRow, ActionRow, ButtonCircle, Stack } from '@/app/components';
import { useAccountDisplayData } from '@/app/hooks';
import React from 'react';
import { View } from 'react-native';

/** @typedef {import('@/app/screens/multisig/types/Multisig').Cosignatory} Cosignatory */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * CosignatoryList component. Displays a list of cosignatory accounts with optional
 * remove functionality for editing mode.
 * @param {object} props - Component props.
 * @param {boolean} [props.isEditable=false] - Whether to show remove buttons.
 * @param {(address: Cosignatory) => void} [props.onRemove] - Callback when a cosignatory is removed.
 * @param {Cosignatory[]} props.cosignatories - List of cosignatory addresses.
 * @param {ChainName} [props.chainName] - The chain the accounts belong to. Defaults to the main chain.
 * @returns {React.ReactNode} CosignatoryList component.
 */
export const CosignatoryList = ({
	isEditable = false,
	onRemove,
	cosignatories,
	chainName
}) => {
	const cosignatoriesDisplayData = useAccountDisplayData(cosignatories, chainName);

	const handleRemovePress = address => {
		if (isEditable && onRemove)
			onRemove(address);
	};

	return (
		<Stack gap="s">
			{cosignatories.map((address, index) => (
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
						<AccountRow
							address={address}
							name={cosignatoriesDisplayData[index].name}
						/>
					</ActionRow>
				</View>
			))}
		</Stack>
	);
};
