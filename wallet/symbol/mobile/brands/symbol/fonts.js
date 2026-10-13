import { Platform } from 'react-native';

export const Fonts = {
	primary: {
		regular: {
			fontFamily: 'Protipo-Regular'
		},
		bold: {
			fontFamily: 'Protipo-Bold'
		}
	},
	secondary: {
		bold: {
			fontFamily: 'SofiaSansCondensed-ExtraBold',
			fontWeight: Platform.select({ ios: '700', android: undefined })
		}
	},
	monospace: {
		bold: {
			fontFamily: 'JetBrainsMono-Bold'
		}
	}
};
