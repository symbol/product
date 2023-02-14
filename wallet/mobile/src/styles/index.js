import { Easing } from 'react-native-reanimated';
import DesignSystem from './designSystem.json';
export { default as DesignSystem } from './designSystem.json';

export const colors = {
    transparent: 'transparent',
    primary: DesignSystem.ColorDarkmodeTextLearnMore,
    secondary: '#605C6B',

    bgStatusbar: '#000000',
    bgNavbar: '#1A1A1A',
    bgTabsNavigator: '#1b0a29',
    bgTabsNavigatorActive: '#1e2f52',
    bgFooter: DesignSystem.ColorDarkmodeBgFooter,
    bgBody: DesignSystem.ColorDarkmodeBgDark,
    bgMain: DesignSystem.ColorDarkmodeBgMain,
    bgGray: DesignSystem.ColorDarkmodeBgGray,
    bgAccountCard: DesignSystem.ColorDarkmodeBgMain,
    bgAccountCardSelected: '#2f0b40',

    bgCard: '#413c4f',
    bgCardTransparent: 'rgba(241, 243, 244, 0.15)',
    bgForm: DesignSystem.ColorDarkmodeFormBg,
    bgActive: '#112844',
    formNeutral: '#6C6C6C',
    accentFormOpacity: '#38094f',
    accentForm: DesignSystem.ColorDarkmodeFormAccent,
    accentLightForm: DesignSystem.ColorDarkmodeFormAccentLight,
    textForm: DesignSystem.ColorDarkmodeFormText,

    textBody: DesignSystem.ColorDarkmodeTextBody,
    textTitle: DesignSystem.ColorDarkmodeTextTitle,
    textLink: DesignSystem.ColorDarkmodeTextLearnMore,
    testSubtitle: DesignSystem.ColorDarkmodeTextSubtitle,
    testFooter: DesignSystem.ColorDarkmodeTextFooter,

    dataColor1: DesignSystem.ColorDarkmodeDataColor1,
    dataColor2: DesignSystem.ColorDarkmodeDataColor2,
    dataColor3: DesignSystem.ColorDarkmodeDataColor3,
    dataColor4: DesignSystem.ColorDarkmodeDataColor4,
    dataColor5: DesignSystem.ColorDarkmodeDataColor5,

    danger: DesignSystem.ColorDarkmodeSemanticBad,
    warning: DesignSystem.ColorDarkmodeSemanticCaution,
    success: DesignSystem.ColorDarkmodeSemanticGood,
    neutral: DesignSystem.ColorDarkmodeSemanticNeutral,
    info: DesignSystem.ColorDarkmodeSemanticInfo,

    bgDanger: DesignSystem.ColorLightmodeSemanticBad,
    bgWarning: DesignSystem.ColorLightmodeSemanticCaution,
    bgSuccess: DesignSystem.ColorLightmodeSemanticGood,
    bgNeutral: DesignSystem.ColorLightmodeSemanticNeutral,
    bgInfo: DesignSystem.ColorLightmodeSemanticInfo,

    controlButtonStroke: DesignSystem.ColorDarkmodeButtonDefaultStroke,
    controlButtonBg: DesignSystem.ColorDarkmodeButtonDefaultBg,
    controlButtonText: DesignSystem.ColorDarkmodeButtonDefaultText,

    controlButtonPressedStroke: DesignSystem.ColorDarkmodeButtonPressedStroke,
    controlButtonPressedBg: '#112844',
    controlButtonPressedText: DesignSystem.ColorDarkmodeButtonDefaultText,

    controlButtonDisabledStroke: '#26c3f244',
    controlButtonDisabledBg: DesignSystem.ColorDarkmodeButtonPressedBg,
    controlButtonDisabledText: '#26c3f255',

    controlBaseStroke: DesignSystem.ColorDarkmodeFormAccentLight,
    controlBaseBg: DesignSystem.ColorDarkmodeFormBg,
    controlBaseText: DesignSystem.ColorDarkmodeFormText,
    controlBaseTextAlt: 'rgba(255, 255, 255, 0.7)',
    controlBasePlaceholder: '#858585',

    controlBaseFocussedStroke: DesignSystem.ColorDarkmodeFormAccent,
    controlBasePressedStroke: DesignSystem.ColorDarkmodeFormAccent,
};

export const fonts = {
    button: {
        fontFamily: 'Rajdhani-Bold',
        fontSize: 17,
        textTransform: 'uppercase',
    },
    textBox: {
        fontFamily: 'Protipo-Regular',
        fontSize: 13,
    },
    placeholder: {
        fontFamily: 'Carbon-Bold',
        fontSize: 13,
        textTransform: 'uppercase',
    },
    label: {
        fontFamily: 'Carbon-Bold',
        fontSize: 17,
        lineHeight: 17,
        textTransform: 'uppercase',
    },
    transactionSignerName: {
        fontFamily: 'Carbon-Bold',
        fontSize: 14,
        lineHeight: 14,
        textTransform: 'uppercase',
    },
    tab: {
        fontFamily: 'Carbon-Bold',
        fontSize: 13,
        lineHeight: 15.6,
        textTransform: 'uppercase',
    },
    body: {
        fontFamily: 'Protipo-Regular',
        fontSize: 13,
    },
    bodyBold: {
        fontFamily: 'Protipo-Bold',
        fontSize: 13,
    },
    subtitle: {
        fontFamily: 'Protipo-Bold',
        fontSize: 17,
    },
    title: {
        fontFamily: 'Rajdhani-Bold',
        fontSize: 24,
        lineHeight: 26,
        textTransform: 'uppercase',
    },
    titleLarge: {
        fontFamily: 'Rajdhani-Bold',
        fontSize: 40,
        lineHeight: 48,
        textTransform: 'uppercase',
    },
    amount: {
        fontFamily: 'Protipo-Regular',
        fontSize: 24,
        lineHeight: 29,
    },
};

export const borders = {
    borderRadius: 4,
    borderRadiusForm: 12,
    borderRadiusControl: 4,
    borderRadiusAccountSelector: 8,
    borderWidth: 2,
};

export const spacings = {
    controlHeight: 48,
    margin: 12,
    marginLg: 30,
    paddingSm: 8,
    padding: 16,
    padding2: 24,
};

export const layout = {
    row: {
        flexDirection: 'row',
    },
    justifyCenter: {
        justifyContent: 'center',
    },
    justifyBetween: {
        justifyContent: 'space-between',
    },
    alignCenter: {
        alignItems: 'center',
    },
    alignEnd: {
        alignItems: 'flex-end',
    },
    fill: {
        flex: 1,
    },
    listContainer: {
        paddingTop: spacings.margin,
    },
};

export const timings = {
    press: {
        duration: 100,
        easing: Easing.linear,
    },
};
