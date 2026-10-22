import { SymbolRouter } from '../../../router/SymbolRouter';
import { ButtonPlain, Divider, Stack } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';
import { isMosaicRevokable, isMosaicSupplyModifiable } from 'wallet-common-symbol';

/** @typedef {import('@/app/screens/assets/types/Assets').TokenDetailsActionProps} TokenDetailsActionProps */

/**
 * MosaicCreatorActions component. Shows the revoke and modify buttons on TokenDetails.
 * @param {TokenDetailsActionProps} props - Component props.
 * @returns {React.ReactNode} MosaicCreatorActions component.
 */
export const MosaicCreatorActions = ({ token, chainName, tokenOwnerAccountAddress, currentAccount, networkProperties }) => {
	const isCurrentAccountOwner = tokenOwnerAccountAddress === currentAccount.address;
	const canRevokeMosaic = isCurrentAccountOwner
		&& isMosaicRevokable(token, networkProperties?.chainHeight, tokenOwnerAccountAddress);
	const canModifyMosaic = isCurrentAccountOwner
		&& isMosaicSupplyModifiable(token, networkProperties?.chainHeight, tokenOwnerAccountAddress);
	const openRevokeScreen = () => SymbolRouter.goToRevokeMosaic({ params: { chainName, mosaicId: token.id } });
	const openModifyScreen = () => SymbolRouter.goToModifyMosaic({ params: { chainName, mosaicId: token.id } });

	if (!canRevokeMosaic && !canModifyMosaic)
		return null;

	return (
		<Stack>
			<Divider />
			{canRevokeMosaic && (
				<ButtonPlain
					icon="revoke"
					text={$t('button_revokeMosaic')}
					onPress={openRevokeScreen}
				/>
			)}
			{canModifyMosaic && (
				<ButtonPlain
					icon="edit"
					text={$t('button_modifyMosaic')}
					onPress={openModifyScreen}
				/>
			)}
		</Stack>
	);
};
