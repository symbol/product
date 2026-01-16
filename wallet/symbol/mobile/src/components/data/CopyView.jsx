import { ActionRow, ButtonCopy, StyledText } from '@/app/components';
import React from 'react';

/**
 * Copy view component
 * Displays a text with a copy button.
 * 
 * @param {object} props - Component props
 * @param {string} props.value - Value to be displayed and copied
 * @param {boolean} [props.isStretched=false] - If true, the component will stretch to fill the available width
 * 
 * @returns {React.ReactNode} Copy view component
 */
export const CopyView = ({ value, isStretched }) => (
	<ActionRow isStretched={isStretched} button={<ButtonCopy content={value} />}>
		<StyledText>{value}</StyledText>
	</ActionRow>
);
