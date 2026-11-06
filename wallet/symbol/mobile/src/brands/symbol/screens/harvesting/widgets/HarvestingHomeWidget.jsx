import { HarvestingWidget } from './HarvestingWidget';
import { useHarvestingWidget } from '../hooks/useHarvestingWidget';
import { WidgetAnimatedWrapper } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import React from 'react';

/** @typedef {import('@/app/types/RefreshController').RefreshController} RefreshController */

/**
 * HarvestingHomeWidget component. A self-contained harvesting widget for the Home screen: 
 * it loads its own data and is shown only when the current account has harvesting data.
 * A refresh can be triggered by Home screen.
 * @param {object} props - Component props.
 * @param {RefreshController} props.refreshController - Home screen refresh controller.
 * @returns {React.ReactNode} HarvestingHomeWidget component.
 */
export const HarvestingHomeWidget = ({ refreshController }) => {
	const walletController = useWalletController();
	const harvestingWidget = useHarvestingWidget(walletController, refreshController);

	return (
		<WidgetAnimatedWrapper isVisible={harvestingWidget.isVisible}>
			<HarvestingWidget
				summaryViewModel={harvestingWidget.props.summaryViewModel}
				statusViewModel={harvestingWidget.props.statusViewModel}
				ticker={harvestingWidget.props.ticker}
			/>
		</WidgetAnimatedWrapper>
	);
};
