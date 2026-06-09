import { WalletActionListItem } from './WalletActionListItem';
import { Stack, StyledText } from '@/app/components';
import React from 'react';

/**
 * Wallet action group component. Displays a labelled group of wallet action items.
 * @param {object} props - Component props.
 * @param {string} props.title - Group label text.
 * @param {object[]} props.data - List of wallet action items to render.
 * @param {string} props.data[].icon - Action icon name.
 * @param {string} props.data[].title - Action title.
 * @param {string} props.data[].description - Action description.
 * @param {function(): void} props.data[].handlePress - Function to call when the action item is pressed.
 * @returns {React.ReactNode} Wallet action group component.
 */
export const WalletActionGroup = ({ title, data }) => {
	return (
		<Stack gap="s">
			<StyledText>{title}</StyledText>
			{data.map((action, index) => (
				<WalletActionListItem
					key={index}
					icon={action.icon}
					title={action.title}
					description={action.description}
					index={index}
					onPress={action.handlePress}
				/>
			))}
		</Stack>
	);
};
