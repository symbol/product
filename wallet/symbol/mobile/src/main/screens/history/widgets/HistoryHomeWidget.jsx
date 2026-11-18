import { HistoryWidget } from './HistoryWidget';
import { Stack, StyledText, WidgetAnimatedWrapper } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { useHistoryWidget } from '@/app/screens/history/hooks/useHistoryWidget';
import React from 'react';

/** @typedef {import('@/app/types/RefreshController').RefreshController} RefreshController */

/**
 * HistoryHomeWidget component. A self-contained history widget for the Home screen: 
 * it loads its own data and is shown only when the current account has unconfirmed or partial transactions. 
 * A refresh can be triggered by Home screen.
 * @param {object} props - Component props.
 * @param {RefreshController} props.refreshController - Home screen refresh controller.
 * @returns {React.ReactNode} HistoryHomeWidget component.
 */
export const HistoryHomeWidget = ({ refreshController }) => {
	const walletController = useWalletController();
	const historyWidget = useHistoryWidget(walletController, refreshController);

	if (!historyWidget.isVisible)
		return null;

	return (
		<Stack gap="m">
			<StyledText type="title">
				{$t('screen_home_title_updates')}
			</StyledText>
			<WidgetAnimatedWrapper isVisible>
				<HistoryWidget
					unconfirmed={historyWidget.props.unconfirmed}
					partial={historyWidget.props.partial}
					chainName={historyWidget.props.chainName}
					networkIdentifier={historyWidget.props.networkIdentifier}
					ticker={historyWidget.props.ticker}
					currentAccount={historyWidget.props.currentAccount}
					isCurrentAccountMultisig={historyWidget.props.isCurrentAccountMultisig}
					walletAccounts={historyWidget.props.walletAccounts}
					addressBook={historyWidget.props.addressBook}
				/>
			</WidgetAnimatedWrapper>
		</Stack>
	);
};
