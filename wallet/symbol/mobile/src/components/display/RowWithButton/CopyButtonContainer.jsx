import { ActionRow, CopyButton } from '@/app/components';
import React from 'react';

/**
 * Copy view component
 * Displays a text with a copy button.
 * 
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child component to display
 * @param {string} props.value - Value to be copied
 * @param {boolean} [props.isStretched=false] - If true, the component will stretch to fill the available width
 * 
 * @returns {React.ReactNode} Copy view component
 */
export const CopyButtonContainer = ({ children, value, isStretched }) => (
	<ActionRow 
		isStretched={isStretched} 
		button={<CopyButton content={value} />}
	>
		{children}
	</ActionRow>
);
