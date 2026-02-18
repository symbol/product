import { Primitives } from './primitives';
import { Platform } from 'react-native';

const Fonts = {
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

export const Semantic = {
	body: {
		s: {
			...Fonts.primary.regular,
			fontSize: Primitives.s[0],
			lineHeight: Primitives.s[1]
		},
		m: {
			...Fonts.primary.regular,
			fontSize: Primitives.m[0],
			lineHeight: Primitives.m[1]
		},
		l: {
			...Fonts.primary.regular,
			fontSize: Primitives.l[0],
			lineHeight: Primitives.l[1]
		},
		xl: {
			...Fonts.primary.regular,
			fontSize: Primitives.xl[0],
			lineHeight: Primitives.xl[1]
		}
	},
	bodyBold: {
		s: {
			...Fonts.primary.bold,
			fontSize: Primitives.s[0],
			lineHeight: Primitives.s[1],
			textTransform: 'uppercase'
		},
		m: {
			...Fonts.primary.bold,
			fontSize: Primitives.m[0],
			lineHeight: Primitives.m[1],
			textTransform: 'uppercase'
		},
		l: {
			...Fonts.primary.bold,
			fontSize: Primitives.l[0],
			lineHeight: Primitives.l[1],
			textTransform: 'uppercase'
		},
		xl: {
			...Fonts.primary.bold,
			fontSize: Primitives.xl[0],
			lineHeight: Primitives.xl[1],
			textTransform: 'uppercase'
		}
	},
	title: {
		s: {
			...Fonts.secondary.bold,
			fontSize: Primitives.l[0],
			lineHeight: Primitives.l[1]
		},
		m: {
			...Fonts.secondary.bold,
			fontSize: Primitives.xl[0],
			lineHeight: Primitives.xl[1],
			textTransform: 'uppercase'
		},
		l: {
			...Fonts.secondary.bold,
			fontSize: Primitives.xxl[0],
			lineHeight: Primitives.xxl[1],
			textTransform: 'uppercase'
		}
	},
	button: {
		m: {
			...Fonts.secondary.bold,
			fontSize: Primitives.l[0],
			lineHeight: Primitives.l[1],
			textTransform: 'uppercase'
		}
	},
	link: {
		s: {
			...Fonts.monospace.bold,
			fontSize: Primitives.s[0],
			lineHeight: Primitives.s[1],
			textTransform: 'uppercase'
		},
		m: {
			...Fonts.monospace.bold,
			fontSize: Primitives.m[0],
			lineHeight: Primitives.m[1],
			textTransform: 'uppercase'
		}
	},
	input: {
		m: {
			...Fonts.primary.regular,
			fontSize: Primitives.m[0],
			lineHeight: Primitives.m[1]
		}
	},
	label: {
		s: {
			...Fonts.secondary.bold,
			fontSize: Primitives.s[0],
			lineHeight: Primitives.s[1],
			textTransform: 'uppercase'
		},
		m: {
			...Fonts.monospace.bold,
			fontSize: Primitives.m[0],
			lineHeight: Primitives.m[1],
			textTransform: 'uppercase'
		}
	},
	mnemonic: {
		m: {
			...Fonts.monospace.bold,
			fontSize: Primitives.m[0],
			lineHeight: Primitives.m[1],
			textTransform: 'uppercase'
		}
	}
};
