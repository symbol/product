import { Checkbox, Stack, StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').MosaicFlagName} MosaicFlagName */
/** @typedef {import('@/app/screens/mosaic/types/Mosaic').MosaicFlags} MosaicFlags */

const FLAG_SECTIONS = [
	{
		flagName: 'isSupplyMutable',
		titleKey: 's_mosaicCreation_supplyMutable_title',
		descriptionKey: 's_mosaicCreation_supplyMutable_description',
		checkboxKey: 's_mosaicCreation_supplyMutable_checkbox'
	},
	{
		flagName: 'isTransferable',
		titleKey: 's_mosaicCreation_transferable_title',
		descriptionKey: 's_mosaicCreation_transferable_description',
		checkboxKey: 's_mosaicCreation_transferable_checkbox'
	},
	{
		flagName: 'isRestrictable',
		titleKey: 's_mosaicCreation_restrictable_title',
		descriptionKey: 's_mosaicCreation_restrictable_description',
		checkboxKey: 's_mosaicCreation_restrictable_checkbox'
	},
	{
		flagName: 'isRevokable',
		titleKey: 's_mosaicCreation_revokable_title',
		descriptionKey: 's_mosaicCreation_revokable_description',
		checkboxKey: 's_mosaicCreation_revokable_checkbox'
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
