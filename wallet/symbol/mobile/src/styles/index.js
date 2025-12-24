import DesignSystem from './designSystem.json';
import { Platform } from 'react-native';
import { Easing } from 'react-native-reanimated';
export { default as DesignSystem } from './designSystem.json';

const primaryColors = {
	purple: {
		default: '#B429FA',

		// Lightness
		l90: '#440066',
		l80: '#660099',
		l70: '#8800CC',
		l60: '#AA00FF',
		l50: '#BB33FF',
		l40: '#CC66FF',
		l30: '#DD99FF',
		l20: '#EECCFF',

		// Saturation
		s20: '#886699',
		s30: '#8C59A6',
		s40: '#914DB3',
		s50: '#9540BF',
		s60: '#9933CC',
		s70: '#9D26D9',
		s80: '#A219E6',
		s90: '#A60DF2',
		s100: '#AA00FF'
	},
	aqua: {
		default: '#26C3F2',

		// Lightness
		l90: '#064B60',
		l80: '#087191',
		l70: '#0B96C1',
		l60: '#0EBCF1',
		l50: '#3EC9F4',
		l40: '#6ED7F7',
		l30: '#9FE4F9',
		l20: '#CFF2FC',

		// Saturation
		s20: '#7598A3',
		s30: '#6A9FAF',
		s40: '#5EA5BA',
		s50: '#53ABC6',
		s60: '#47B1D1',
		s70: '#3CB7DD',
		s80: '#30BDE8',
		s90: '#25C3F4',
		s100: '#1AC9FF'
	}
}

export const colors = {
    transparent: 'transparent',
    primary: '#26c3f2',
    secondary: '#605C6B',

    bgStatusbar: '#000000',
    bgNavbar: '#1A1A1A',
    bgTabsNavigator: '#1b0a29',
    bgTabsNavigatorActive: '#1e2f52',
    bgFooter: '#0b0118',
    bgBody: '#0b0118',
    bgMain: '#1b0a29',
    bgGray: '#221c31',
    bgAccountCard: '#1b0a29',
    bgAccountCardSelected: '#2f0b40',

    bgCard: '#413c4f',
    bgCardTransparent: 'rgba(241, 243, 244, 0.15)',
    bgForm: '#000000',
    bgActive: '#112844',
    formNeutral: '#6C6C6C',
    accentFormOpacity: '#38094f',
    accentForm: '#7413a4',
    accentLightForm: '#b429fa',
    textForm: '#ffffff',

    textBody: '#ffffff', 
    textTitle: '#b429fa', 
    textLink: '#26c3f2', 
    testSubtitle: '#ffffff', 
    testFooter: '#ffffff', 

    dataColor1: '#b429fa', 
    dataColor2: '#5874ff', 
    dataColor3: '#0099ff', 
    dataColor4: '#00b3ff', 
    dataColor5: '#26c3f2', 

    danger: '#ff9999', 
    warning: '#f7c06e', 
    success: '#b3e6b3', 
    neutral: '#c7ced1', 
    info: '#9ed1fa', 

    bgDanger: '#cc0000', 
    bgWarning: '#ff9900', 
    bgSuccess: '#287326', 
    bgNeutral: '#5c6970', 
    bgInfo: '#4086bf', 

    controlButtonStroke: '#26c3f2', 
    controlButtonBg: '#0b0118', 
    controlButtonText: '#26c3f2', 

    controlButtonPressedStroke: '#26c3f2', 
    controlButtonPressedBg: '#112844',
    controlButtonPressedText: '#26c3f2', 

    controlButtonDisabledStroke: '#26c3f244',
    controlButtonDisabledBg: '#0b0118', 
    controlButtonDisabledText: '#26c3f255',

    controlBaseStroke: '#b429fa', 
    controlBaseBg: '#000000', 
    controlBaseText: '#ffffff', 
    controlBaseTextAlt: 'rgba(255, 255, 255, 0.7)',
    controlBasePlaceholder: '#858585',

    controlBaseFocussedStroke: '#7413a4', 
    controlBasePressedStroke: '#7413a4', 

    dangerButtonBg: '#0b0118', 
    dangerButtonPressedBg: '#3a1b1bff',
    dangerButtonStroke: '#ff9999', 
    dangerButtonPressedStroke: '#ff9999', 
    dangerButtonText: '#ff9999', 
    dangerButtonPressedText: '#ff9999', 

    warningButtonBg: '#f7c06e', 
    warningButtonPressedBg: '#e6a94f',
    warningButtonStroke: '#000000',
    warningButtonPressedStroke: '#000000',
    warningButtonText: '#000000',
    warningButtonPressedText: '#000000',
};

export const fonts = {
    button: {
        fontFamily: 'SofiaSansCondensed-ExtraBold',
        fontWeight: Platform.select({ ios: '700', android: undefined }),
        fontSize: 17,
        textTransform: 'uppercase'
    },
    textBox: {
        fontFamily: 'Protipo-Regular',
        fontSize: 13
    },
    placeholder: {
        fontFamily: 'JetBrainsMono-Bold',
        fontSize: 10,
        textTransform: 'uppercase'
    },
    label: {
        fontFamily: 'JetBrainsMono-Bold',
        fontSize: 13,
        lineHeight: 17,
        letterSpacing: 0.2,
        textTransform: 'uppercase'
    },
    transactionSignerName: {
        fontFamily: 'JetBrainsMono-Bold',
        fontSize: 11,
        lineHeight: 14,
        letterSpacing: 0.2,
        textTransform: 'uppercase'
    },
    tab: {
        fontFamily: 'JetBrainsMono-Bold',
        fontSize: 10,
        lineHeight: 16,
        letterSpacing: 0.2,
        textTransform: 'uppercase'
    },
    filterChip: {
        fontFamily: 'JetBrainsMono-Bold',
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 0.2,
        textTransform: 'uppercase'
    },
    body: {
        fontFamily: 'Protipo-Regular',
        fontSize: 13
    },
    bodyBold: {
        fontFamily: 'Protipo-Bold',
        fontSize: 13
    },
    subtitle: {
        fontFamily: 'Protipo-Bold',
        fontSize: 17
    },
    title: {
        fontFamily: 'SofiaSansCondensed-ExtraBold',
        fontWeight: Platform.select({ ios: '700', android: undefined }),
        fontSize: 24,
        lineHeight: 26,
        textTransform: 'uppercase'
    },
    titleLarge: {
        fontFamily: 'SofiaSansCondensed-ExtraBold',
        fontSize: 40,
        lineHeight: 48,
        textTransform: 'uppercase'
    },
    amount: {
        fontFamily: 'Protipo-Regular',
        fontSize: 24,
        lineHeight: 29
    },
    notification: {
        fontFamily: 'Protipo-Regular',
        fontSize: 12,
        lineHeight: 14
    }
};

export const borders = {
    borderRadius: 4,
    borderRadiusItemCard: 8,
    borderRadiusForm: 12,
    borderRadiusControl: 4,
    borderRadiusAccountSelector: 8,
    borderWidth: 2
};

export const spacings = {
    controlHeight: 48,
    margin: 12,
    marginLg: 30,
    paddingSm: 8,
    padding: 16,
    padding2: 24
};

export const layout = {
    row: {
        flexDirection: 'row'
    },
    justifyCenter: {
        justifyContent: 'center'
    },
    justifyBetween: {
        justifyContent: 'space-between'
    },
    alignCenter: {
        alignItems: 'center'
    },
    alignEnd: {
        alignItems: 'flex-end'
    },
    alignSelfCenter: {
        alignSelf: 'center'
    },
    fill: {
        flex: 1
    },
    listContainer: {
        paddingTop: spacings.margin
    }
};

export const timings = {
    press: {
        duration: 100,
        easing: Easing.linear
    }
};
