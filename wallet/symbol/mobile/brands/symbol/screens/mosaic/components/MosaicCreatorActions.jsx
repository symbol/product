import { SymbolRouter } from '../../../router/SymbolRouter';
import { ButtonPlain, Divider, Stack } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';
import { isMosaicRevokable, isMosaicSupplyModifiable } from 'wallet-common-symbol';

/** @typedef {import('@/app/screens/assets/types/Assets').TokenDetailsActionProps} TokenDetailsActionProps */

/**
 * MosaicCreatorActions component. Shows the revoke and modify buttons on TokenDetails when the current account
 * created the mosaic and the mosaic flags allow the action. Renders nothing when no action is allowed.
 * @param {TokenDetailsActionProps} props - Component props.
 * @returns {React.ReactNode} MosaicCreatorActions component.
 */
export const MosaicCreatorActions = ({ token, tokenId, chainName, accountAddress, walletController }) => {
	const { currentAccount, networkProperties } = walletController;

	const isCurrentAccountCreator = accountAddress === currentAccount.address;
	const canRevokeMosaic = isCurrentAccountCreator
		&& isMosaicRevokable(token, networkProperties?.chainHeight, accountAddress);
	const canModifyMosaic = isCurrentAccountCreator
		&& isMosaicSupplyModifiable(token, networkProperties?.chainHeight, accountAddress);
	const openRevokeScreen = () => SymbolRouter.goToRevokeMosaic({ params: { chainName, mosaicId: tokenId } });
	const openModifyScreen = () => SymbolRouter.goToModifyMosaic({ params: { chainName, mosaicId: tokenId } });

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
