import { ActionRow, Icon } from '@/app/components';
import React from 'react';
import { TouchableOpacity } from 'react-native';

/**
 * Edit view container component
 * Displays a child component with an edit button.
 * 
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child component to display
 * @param {function} props.onEditPress - Callback when edit button is pressed
 * @param {boolean} [props.isStretched=false] - If true, the component will stretch to fill the available width
 * 
 * @returns {React.ReactNode} Edit view component
 */
export const EditButtonContainer = ({ children, onEditPress, isStretched = false }) => (
	<ActionRow
		isStretched={isStretched}
		button={
			<TouchableOpacity
				accessibilityRole="button"
				hitSlop={10} 
				onPress={onEditPress}
			>
				<Icon name="edit" size="s" />
			</TouchableOpacity>
		}
	>
		{children}
	</ActionRow>
);
