import { IdentityRow } from '../IdentityRow';
import { StyledText, TokenAvatar } from '@/app/components';
import React from 'react';

/**
 * TokenRow component. Identity row for a token: avatar next to the optional name and the token id.
 * The id is de-emphasized when a name is shown and becomes the primary line otherwise.
 * @param {object} props - Component props.
 * @param {string} props.tokenId - Token identifier, always shown.
 * @param {string} [props.name] - Resolved token name.
 * @param {string} [props.imageId] - Known token image identifier.
 * @param {React.ReactNode} [props.accessory] - Optional element rendered on the right side of the row.
 * @returns {React.ReactNode} TokenRow component.
 */
export const TokenRow = ({ tokenId, name, imageId, accessory }) => {
	const isNameVisible = !!name;
	const idTextVariant = isNameVisible ? 'secondary' : 'primary';

	return (
		<IdentityRow avatar={<TokenAvatar imageId={imageId} size="m" />} accessory={accessory}>
			{isNameVisible && (
				<StyledText numberOfLines={1}>
					{name}
				</StyledText>
			)}
			<StyledText variant={idTextVariant}>
				{tokenId}
			</StyledText>
		</IdentityRow>
	);
};
