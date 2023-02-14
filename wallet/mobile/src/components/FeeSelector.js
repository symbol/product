import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Slider from 'react-native-smooth-slider';
import { $t } from 'src/localization';
import { borders, colors, fonts, spacings } from 'src/styles';
import { useToggle } from 'src/utils';

const images = [
    require('src/assets/images/fees-slow-3.png'),
    require('src/assets/images/fees-medium-3.png'),
    require('src/assets/images/fees-fast-3.png'),
];

export const FeeSelector = (props) => {
    const { style, title, fees, ticker, value, onChange } = props;
    const [sliderKey, refreshSlider] = useToggle(true);
    const imageTranslation = useSharedValue(0);
    const minimumSliderValue = 0;
    const maximumSliderValue = 2;
    const options = [
        {
            label: $t('selector_fee_slow'),
            speed: 'slow',
            value: fees.slow,
        },
        {
            label: $t('selector_fee_medium'),
            speed: 'medium',
            value: fees.medium,
        },
        {
            label: $t('selector_fee_fast'),
            speed: 'fast',
            value: fees.fast,
        },
    ];
    const sliderValue = options.map((option) => option.speed).indexOf(value);
    const imageSrc = images[sliderValue];

    const selectedFeeValue = options[sliderValue].value;
    const selectedFeeLabel = options[sliderValue].label;
    const valueField = `${selectedFeeLabel} | ${selectedFeeValue} ${ticker}`;

    const animatedImageStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateX: imageTranslation.value,
            },
        ],
    }));

    const handleChange = (newValue) => {
        const newSliderValue = Math.round(newValue);
        onChange(options[newSliderValue]?.speed || 'medium');
        if (newSliderValue !== sliderValue) {
            imageTranslation.value = -500;
            imageTranslation.value = withTiming(0);
        }
    };
    const handleSlidingComplete = () => {
        refreshSlider();
    };

    return (
        <View style={[styles.root, style]}>
            <View style={styles.textContainer}>
                <Animated.Image source={imageSrc} style={[animatedImageStyle, styles.modalImage]} />
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.value}>{valueField}</Text>
            </View>
            <Slider
                value={sliderValue}
                minimumValue={minimumSliderValue}
                maximumValue={maximumSliderValue}
                minimumTrackTintColor={colors.transparent}
                maximumTrackTintColor={colors.transparent}
                style={styles.slider}
                trackStyle={styles.track}
                thumbStyle={styles.thumb}
                thumbTouchSize={{ width: 60, height: 60 }}
                useNativeDriver={true}
                key={sliderKey}
                onValueChange={handleChange}
                onSlidingComplete={handleSlidingComplete}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        height: spacings.controlHeight,
        borderTopLeftRadius: borders.borderRadius,
        borderTopRightRadius: borders.borderRadius,
        borderWidth: borders.borderWidth,
        borderBottomColor: colors.controlBaseStroke,
        backgroundColor: colors.controlBaseBg,
    },
    textContainer: {
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingHorizontal: spacings.margin,
    },
    title: {
        ...fonts.placeholder,
        color: colors.controlBasePlaceholder,
        marginTop: -fonts.placeholder.fontSize / 2,
    },
    value: {
        ...fonts.textBox,
        color: colors.controlBaseText,
    },
    slider: {
        marginTop: -18,
        marginHorizontal: spacings.padding,
    },
    track: {
        height: borders.borderWidth,
    },
    thumb: {
        backgroundColor: colors.textBody,
        borderWidth: borders.borderWidth,
        borderColor: colors.controlBaseStroke,
    },
    modalImage: {
        width: 68,
        height: '100%',
        top: 0,
        right: 0,
        position: 'absolute',
        resizeMode: 'contain',
    },
});
