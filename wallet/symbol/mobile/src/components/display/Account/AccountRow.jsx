import { IdentityRow } from '../IdentityRow';
import { AccountAvatar, StyledText } from '@/app/components';
import React from 'react';

/**
 * AccountRow component. Identity row for an account: avatar next to the optional name and the
 * address.
 * @param {object} props - Component props.
 * @param {string} props.address - Account address, always shown.
 * @param {string} [props.name] - Resolved account name, shown above the address.
 * @param {string} [props.imageId] - Known account image identifier.
 * @returns {React.ReactNode} AccountRow component.
 */
export const AccountRow = ({ address, name, imageId }) => {
	const isNameVisible = !!name;
	const addressTextSize = isNameVisible ? 's' : 'm';

	return (
		<IdentityRow avatar={<AccountAvatar address={address} imageId={imageId} size="m" />}>
			{isNameVisible && (
				<StyledText>
					{name}
				</StyledText>
			)}
			<StyledText size={addressTextSize}>
				{address}
			</StyledText>
		</IdentityRow>
	);
};
