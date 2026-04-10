import { HarvestingSummary } from '../components';
import { WidgetContainer } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import React from 'react';

/** @typedef {import('@/app/screens/harvesting/utils/harvesting-summary').HarvestingSummaryViewModel} HarvestingSummaryViewModel */

/**
 * HarvestingWidget component. Displays harvesting status and summary in a card widget
 * on the home screen.
 *
 * @param {Object} props - Component props.
 * @param {HarvestingSummaryViewModel} props.summaryViewModel - Summary view model.
 * @param {string} props.ticker - Currency ticker symbol.
 * @returns {React.ReactNode} HarvestingWidget component.
 */
export const HarvestingWidget = ({ summaryViewModel, ticker }) => {
	const handleHeaderPress = () => Router.goToHarvesting();

	return (
		<WidgetContainer title={$t('s_actions_harvesting_title')} onHeaderPress={handleHeaderPress}>
			<HarvestingSummary summaryViewModel={summaryViewModel} ticker={ticker} />
		</WidgetContainer>
	);
};
