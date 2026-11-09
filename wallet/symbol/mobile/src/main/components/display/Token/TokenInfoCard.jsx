import { TokenAvatar } from './TokenAvatar';
import { Card, Divider, FlexContainer, Spacer, Stack, StyledText } from '@/app/components';
import { Colors } from '@/app/styles';
import React from 'react';

/**
 * TokenInfoCard component. A card for displaying key token identity details: avatar and name
 * above a divider, with optional fields below it.
 * @param {object} props - Component props.
 * @param {string} [props.name] - Token display name.
 * @param {string} [props.imageId] - Known token image identifier.
 * @param {React.ReactNode} [props.children] - Optional fields rendered below the divider.
 * @param {object} [props.style] - Additional styles for the card container.
 * @returns {React.ReactNode} TokenInfoCard component.
 */
export const TokenInfoCard = ({ name, imageId, children, style }) => (
	<Card style={style}>
		<Spacer>
			<Stack>
				<FlexContainer center>
					<TokenAvatar imageId={imageId} size="l" />
					<StyledText type="title" size="s">
						{name}
					</StyledText>
				</FlexContainer>
				<Divider color={Colors.Semantic.background.tertiary.lighter} />
				{children}
			</Stack>
		</Spacer>
	</Card>
);
