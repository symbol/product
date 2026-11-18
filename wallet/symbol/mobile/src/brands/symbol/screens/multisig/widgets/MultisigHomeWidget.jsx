import { MultisigWidget } from './MultisigWidget';
import { useMultisigWidget } from '../hooks/useMultisigWidget';
import { WidgetAnimatedWrapper } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import React from 'react';

/** @typedef {import('@/app/types/RefreshController').RefreshController} RefreshController */

/**
 * MultisigHomeWidget component. A self-contained multisig-accounts widget for the Home screen: 
 * it loads its own data and is shown only when the current account has multisig accounts. 
 * A refresh can be triggered by Home screen.
 * @param {object} props - Component props.
 * @param {RefreshController} props.refreshController - Home screen refresh controller.
 * @returns {React.ReactNode} MultisigHomeWidget component.
 */
export const MultisigHomeWidget = ({ refreshController }) => {
	const walletController = useWalletController();
	const multisigWidget = useMultisigWidget(walletController, refreshController);

	return (
		<WidgetAnimatedWrapper isVisible={multisigWidget.isVisible}>
			<MultisigWidget
				multisigAccountList={multisigWidget.props.multisigAccountList}
				chainName={multisigWidget.props.chainName}
			/>
		</WidgetAnimatedWrapper>
	);
};
