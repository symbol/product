import { ListItemContainer } from '@/app/components';
import React from 'react';
import { StyleSheet } from 'react-native';

/**
 * PlaceholderListItem component. A placeholder list item for loading states.
 *
 * @returns {React.ReactNode} Placeholder list item component
 */
export const PlaceholderListItem = () => (
	<ListItemContainer cardStyle={styles.root} />
);

const styles = StyleSheet.create({
	root: {
		width: '100%',
		opacity: 0.2
	}
});
