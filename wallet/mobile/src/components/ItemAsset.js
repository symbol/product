import React from 'react';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { $t } from 'src/localization';
import { borders, colors, fonts, spacings } from 'src/styles';
import { trunc } from 'src/utils';
import { FormItem } from './FormItem';

export function ItemAsset(props) {
    const { group, asset } = props;
    const { status, amount, name, id } = asset;
    const amountText = amount ? amount : '';
    const statusText = status === 'active' ? 'active' : 'expired';
    const description = group === 'mosaic'
        ? `Mosaic ID: ${id}`
        : `Linked to: ${trunc(asset.alias.id, 'address')}`
    const iconSrc = group === 'mosaic'
        ? require('src/assets/images/icon-mosaic-native.png')
        : require('src/assets/images/icon-namespace.png')

    const expanded = useSharedValue(0);
    const animatedContainer = useAnimatedStyle(() => ({
        opacity: expanded.value
    }));

    useEffect(() => {
        setTimeout(() => expanded.value = withTiming(1), 150);
    }, [])

    return (
        <FormItem type="list">
                <Animated.View style={[animatedContainer, styles.root]}>
                    <View style={styles.sectionIcon}>
                        <Image source={iconSrc} style={styles.icon} />
                    </View>
                    <View style={styles.sectionMiddle}>
                        <Text style={styles.textName}>{name}</Text>
                        <Text style={styles.textDescription}>{description}</Text>
                        <View style={styles.rowAmount}>
                            <Text style={styles.textStatus}>{statusText}</Text>
                            <Text style={styles.textAmount}>{amountText}</Text>
                        </View>
                    </View>
                </Animated.View>
        </FormItem>
    );
};

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        width: '100%',
        minHeight: 75,
        backgroundColor: colors.bgCard,
        borderColor: colors.bgCard,
        borderWidth: borders.borderWidth,
        borderRadius: borders.borderRadius,
        padding: spacings.paddingSm
    },
    icon: {
        height: 36,
        width: 36
    },
    textName: {
        ...fonts.subtitle,
        color: colors.textBody
    },
    textDescription: {
        ...fonts.body,
        color: colors.textBody
    },
    textStatus: {
        ...fonts.body,
        color: colors.textBody
    },
    textAmount: {
        ...fonts.bodyBold,
        color: colors.textBody
    },
    sectionIcon: {
        flexDirection: 'column',
        justifyContent: 'center',
        paddingRight: spacings.padding
    },
    sectionMiddle: {
        flex: 1,
        flexDirection: 'column',
    },
    rowAmount: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        justifyContent: 'space-between'
    }
});
