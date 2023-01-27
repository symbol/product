import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { $t } from 'src/localization';
import { borders, colors, fonts, spacings } from 'src/styles';
import { blockDurationToDaysLeft, trunc } from 'src/utils';
import { ItemBase } from 'src/components';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';

export function ItemAsset(props) {
    const { group, asset, chainHeight, blockGenerationTargetTime, onPress } = props;
    const { amount, name, id, startHeight, isUnlimitedDuration } = asset;
    const amountText = amount ? amount : '';
    let description;
    let iconSrc;
    let endHeight;

    if (group === 'mosaic') {
        description = $t('s_assets_item_id', {id});
        iconSrc = require('src/assets/images/icon-mosaic-native.png');
        endHeight = asset.startHeight + asset.duration;
    }
    else if (group === 'namespace') {
        const linkedId = asset.linkedMosaicId || asset.linkedAddress;
        description = linkedId 
            ? $t('s_assets_item_linkedTo', {id: trunc(linkedId, 'address')})
            : $t('s_assets_item_notLinked');
        iconSrc = require('src/assets/images/icon-namespace.png');
        endHeight = asset.endHeight;
    }

    const agePercent = chainHeight >= endHeight 
        ? 100
        : Math.trunc(((chainHeight - startHeight) * 100) / (endHeight - startHeight));
    const remainedBlocks = endHeight - chainHeight;
    const statusText = isUnlimitedDuration
        ? ''
        : agePercent === 100 
        ? $t('s_assets_item_expired')
        : $t('s_assets_item_expireIn', {inTime: blockDurationToDaysLeft(remainedBlocks, blockGenerationTargetTime)});

    const progressBarColorStyle = remainedBlocks > 2880 
        ? styles.progressNormal 
        : remainedBlocks > 0 
        ? styles.progressWarning
        : styles.progressExpired
    
    const displayedPercentage = useSharedValue(0);
    const animatedProgressBarStyle = useAnimatedStyle(() => ({
        width: `${displayedPercentage.value}%`
    }));

    const progressBarStyle = [styles.progressBar, progressBarColorStyle, animatedProgressBarStyle];

    useEffect(() => {
        if (!isUnlimitedDuration) {
            setTimeout(() => displayedPercentage.value = withSpring(agePercent), 500);
        }
    }, [displayedPercentage, agePercent])
    
    return (
        <ItemBase contentContainerStyle={styles.root} isLayoutAnimationEnabled onPress={onPress}>
            <View style={styles.sectionIcon}>
                <Image source={iconSrc} style={styles.icon} />
            </View>
            <View style={styles.sectionMiddle}>
                <Text style={styles.textName}>{name}</Text>
                <Text style={styles.textDescription}>{description}</Text>
                <View style={styles.rowAmount}>
                    <View style={styles.status}>
                        {!!statusText && (<>
                            <Text style={styles.textStatus}>{statusText}</Text>
                            <View style={styles.progressBarWrapper}>
                                <Animated.View style={progressBarStyle} />
                            </View> 
                        </>)}
                    </View>
                    <Text style={styles.textAmount}>{amountText}</Text>
                </View>
            </View>
        </ItemBase>
    );
};

const styles = StyleSheet.create({
    root: {
        flexDirection: 'row',
        width: '100%',
        minHeight: 75,
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
        color: colors.textBody,
        opacity: 0.7,
    },
    textStatus: {
        ...fonts.label,
        color: colors.textBody,
        fontSize: 10,
        opacity: 0.7,
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
    },
    status: {
        maxWidth: '50%',
        flex: 1,
        flexDirection: 'column',
    },
    progressBarWrapper: {
        position: 'relative',
        width: '100%',
        height: borders.borderWidth,
        backgroundColor: colors.bgMain,
        overflow: 'hidden'
    },
    progressBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '100%',
    },
    progressNormal: {
        backgroundColor: colors.primary
    },
    progressWarning: {
        backgroundColor: colors.warning
    },
    progressExpired: {
        backgroundColor: colors.danger
    }
});
