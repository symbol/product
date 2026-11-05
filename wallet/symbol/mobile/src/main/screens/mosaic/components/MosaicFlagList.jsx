import { Checkbox, Stack, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').MosaicFlagName} MosaicFlagName */
/** @typedef {import('@/app/screens/mosaic/types/Mosaic').MosaicFlags} MosaicFlags */

const FLAG_SECTIONS = [
	{
		flagName: 'isTransferable',
		titleKey: 'screen_mosaic_title_transferable',
		descriptionKey: 'screen_mosaic_description_transferable',
		checkboxKey: 'screen_mosaic_checkbox_transferable'
	},
	{
		flagName: 'isSupplyMutable',
		titleKey: 'screen_mosaic_title_supplyMutable',
		descriptionKey: 'screen_mosaic_description_supplyMutable',
		checkboxKey: 'screen_mosaic_checkbox_supplyMutable'
	},
	{
		flagName: 'isRestrictable',
		titleKey: 'screen_mosaic_title_restrictable',
		descriptionKey: 'screen_mosaic_description_restrictable',
		checkboxKey: 'screen_mosaic_checkbox_restrictable'
	},
	{
		flagName: 'isRevokable',
		titleKey: 'screen_mosaic_title_revokable',
		descriptionKey: 'screen_mosaic_description_revokable',
		checkboxKey: 'screen_mosaic_checkbox_revokable'
	}
];

/**
 * MosaicFlagList component. Renders the mosaic flag sections,
 * each with a title, a description and a checkbox toggling the flag.
 * @param {object} props - Component props.
 * @param {MosaicFlags} props.flags - The current mosaic flags values.
 * @param {(flagName: MosaicFlagName) => void} props.onFlagToggle - Called with the flag name when a checkbox is toggled.
 * @returns {React.ReactNode} MosaicFlagList component.
 */
export const MosaicFlagList = props => {
	const { flags, onFlagToggle } = props;

	return (
		<Stack gap="l">
			{FLAG_SECTIONS.map(section => (
				<Stack key={section.flagName} gap="s">
					<Stack gap="none">
						<StyledText type="title" size="s">
							{$t(section.titleKey)}
						</StyledText>
						<StyledText type="body">
							{$t(section.descriptionKey)}
						</StyledText>
					</Stack>
					<Checkbox
						text={$t(section.checkboxKey)}
						value={flags[section.flagName]}
						onChange={() => onFlagToggle(section.flagName)}
					/>
				</Stack>
			))}
		</Stack>
	);
};
