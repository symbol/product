import { CopyButtonContainer, Field, Stack, StatusCard, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';

/** @typedef {import('@/app/screens/harvesting/utils/harvesting-status').HarvestingStatusViewModel} HarvestingStatusViewModel */

/**
 * HarvestingStatus component. Displays the current harvesting status with optional warnings
 * and node URL information.
 *
 * @param {Object} props - Component props.
 * @param {HarvestingStatusViewModel} props.statusViewModel - Status view model.
 * @param {boolean} [props.isLoading=false] - Whether data is loading.
 * @returns {React.ReactNode} HarvestingStatus component.
 */
export const HarvestingStatus = ({ statusViewModel, isLoading = false }) => {
	const { statusDisplay, warning, nodeUrl } = statusViewModel;

	return (
		<Stack gap="s">
			<StatusCard
				variant={statusDisplay.variant}
				statusText={statusDisplay.statusText}
				icon={statusDisplay.icon}
				isLoading={isLoading}
			>
				{nodeUrl && (
					<Field title={$t('fieldTitle_nodeUrl')} inverse>
						<CopyButtonContainer value={nodeUrl} inverse>
							<StyledText inverse>
								{nodeUrl}
							</StyledText>
						</CopyButtonContainer>
					</Field>
				)}
				{warning.isVisible && (
					<StyledText inverse>
						{warning.text}
					</StyledText>
				)}
			</StatusCard>
		</Stack>
	);
};
