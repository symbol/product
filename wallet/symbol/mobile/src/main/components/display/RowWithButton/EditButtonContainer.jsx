import { ActionRow, Icon } from '@/app/components';
import React from 'react';
import { TouchableOpacity } from 'react-native';

/**
 * EditButtonContainer component. A container component that displays content alongside an edit button for triggering edit actions.
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child component to display.
 * @param {function(): void} props.onEditPress - Callback when edit button is pressed.
 * @param {boolean} [props.isStretched=false] - If true, the component will stretch to fill the available width.
 * @param {boolean} [props.inverse=false] - If true, uses inverse color scheme for the edit button.
 * @returns {React.ReactNode} EditButtonContainer component.
 */
export const EditButtonContainer = ({ children, onEditPress, isStretched = false, inverse = false }) => (
	<ActionRow
		isStretched={isStretched}
		button={
			<TouchableOpacity
				accessibilityRole="button"
				hitSlop={10} 
				onPress={onEditPress}
			>
				<Icon name="edit" size="xs" variant={inverse ? 'inverse' : 'default'} />
			</TouchableOpacity>
		}
	>
		{children}
	</ActionRow>
);
