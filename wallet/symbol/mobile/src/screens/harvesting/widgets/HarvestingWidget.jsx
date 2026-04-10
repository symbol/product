import { HarvestingSummary } from '../components';
import { WidgetContainer } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import React from 'react';

/** @typedef {import('../types/Harvesting').HarvestingWidgetProps} HarvestingWidgetProps */

/**
 * HarvestingWidget component. Displays harvesting status and summary in a card widget
 * on the home screen.
 *
 * @param {HarvestingWidgetProps} props - Component props.
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
