import { AccountAvatar } from './AccountAvatar';
import { Card, CopyButtonContainer, Divider, Field, FlexContainer, Spacer, Stack, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * AccountInfoCard component. A card for displaying key account identity details, including avatar,
 * name, address, and optional chain name, notes, or extra content above the divider.
 * @param {object} props - Component props.
 * @param {string} props.address - Account address.
 * @param {string} props.name - Account display name.
 * @param {ChainName} [props.chainName] - Optional blockchain name shown above the address.
 * @param {string} [props.notes] - Optional notes shown below the address.
 * @param {string} [props.imageId] - Known account image identifier.
 * @param {React.ReactNode} [props.children] - Optional content rendered below the title row and above the divider.
 * @param {object} [props.style] - Additional styles for the card container.
 * @returns {React.ReactNode} AccountInfoCard component.
 */
export const AccountInfoCard = ({
	address,
	name,
	chainName,
	notes,
	imageId,
	children,
	style
}) => {
	const isChainNameVisible = Boolean(chainName);
	const isNotesVisible = Boolean(notes?.length);

	return (
		<Card style={style}>
			<Spacer>
				<Stack gap="m">
					<Stack gap="s">
						<FlexContainer center>
							<AccountAvatar address={address} imageId={imageId} size="l" />
							<StyledText type="title" size="s">
								{name}
							</StyledText>
						</FlexContainer>
						{children}
					</Stack>
					<Divider accent />
					<Stack>
						{isChainNameVisible && (
							<Field title={$t('fieldTitle_chainName')}>
								<StyledText>
									{chainName}
								</StyledText>
							</Field>
						)}
						<Field title={$t('fieldTitle_address')}>
							<CopyButtonContainer value={address} isStretched>
								<StyledText>
									{address}
								</StyledText>
							</CopyButtonContainer>
						</Field>
						{isNotesVisible && (
							<Field title={$t('fieldTitle_notes')}>
								<StyledText>
									{notes}
								</StyledText>
							</Field>
						)}
					</Stack>
				</Stack>
			</Spacer>
		</Card>
	);
};
