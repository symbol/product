import { HarvestingSummary } from '../components';
import { Divider, Spacer, StatusRow, WidgetContainer } from '@/app/components';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { Colors } from '@/app/styles';
import React from 'react';

/** @typedef {import('../types/Harvesting').HarvestingWidgetProps} HarvestingWidgetProps */

/**
 * HarvestingWidget component. Displays harvesting status and summary in a card widget
 * on the home screen.
 *
 * @param {HarvestingWidgetProps} props - Component props.
 * @returns {React.ReactNode} HarvestingWidget component.
 */
export const HarvestingWidget = ({ summaryViewModel, statusViewModel, ticker }) => {
	const handleHeaderPress = () => Router.goToHarvesting();

	return (
		<WidgetContainer 
			title={$t('s_actions_harvesting_title')} 
			backgroundColor={Colors.Components.summary.background}
			onHeaderPress={handleHeaderPress} 
		>
			<Spacer bottom="s">
				<StatusRow
					statusText={statusViewModel.statusDisplay.statusText}
					icon={statusViewModel.statusDisplay.icon}
					variant={statusViewModel.statusDisplay.variant}
				/>
			</Spacer>
			<Divider />
			<HarvestingSummary summaryViewModel={summaryViewModel} ticker={ticker} />
		</WidgetContainer>
	);
};
