import { StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { Sizes } from '@/app/styles';
import { View } from 'react-native';

/** @typedef {import('react')} React */

/**
 * EmptyListMessage component. Displays a centered message indicating that a list has no items.
 * @returns {React.ReactNode} EmptyListMessage component.
 */
export const EmptyListMessage = () => (
	<View style={styles.root}>
		<StyledText type="label" style={styles.text}>
			{$t('message_emptyList')}
		</StyledText>
	</View>
);

const styles = {
	root: {
		flex: 1,
		width: '100%',
		justifyContent: 'center',
		alignItems: 'center',
		padding: Sizes.Semantic.layoutPadding.l
	},
	text: {
		textAlign: 'center',
		opacity: 0.3
	}
};
