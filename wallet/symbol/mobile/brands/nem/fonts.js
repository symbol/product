import { Platform } from 'react-native';

export const Fonts = {
	primary: {
		regular: {
			fontFamily: 'NunitoSans-Regular'
		},
		bold: {
			fontFamily: 'NunitoSans-Bold'
		}
	},
	secondary: {
		bold: {
			fontFamily: 'NunitoSans-Bold',
			fontWeight: Platform.select({ ios: '700', android: undefined })
		}
	},
	monospace: {
		bold: {
			fontFamily: 'NunitoSans-Bold'
		}
	}
};
