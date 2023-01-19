import React from 'react';
import { Image, StyleSheet, Text, View, } from 'react-native';
import { Dropdown } from 'src/components';
import { colors, fonts, spacings } from 'src/styles';

export const SelectMosaic = props => {
    const { testID, title, value, list, chainHeight, onChange } = props;

    const availableMosaicList = list.filter(item => item.mosaicInfo.endHeight > chainHeight || !item.mosaicInfo.duration);

    const getImageSrc = item => item.mosaicInfo.name === 'symbol.xym' 
        ? require('src/assets/images/icon-select-mosaic-native.png')
        : require('src/assets/images/icon-select-mosaic-custom.png');

    return (
        <Dropdown
            testID={testID}
            title={title}
            value={value}
            list={availableMosaicList}
            onChange={onChange}
            renderItem={({item, index}) => (
                <View style={styles.item}>
                    <View style={styles.label}>
                        <Image source={getImageSrc(item)} style={styles.icon} />
                        <Text style={styles.name}>{item.label}</Text>
                    </View>
                    <Text style={styles.amount}>{availableMosaicList[index].mosaicInfo.amount}</Text>
                </View>
            )}
        />
    );
};

const styles = StyleSheet.create({
    item: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    label: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    icon: {
        height: 24,
        width: 24,
        marginRight: spacings.paddingSm
    },
    name: {
        ...fonts.body,
        color: colors.textBody
    },
    amount: {
        ...fonts.label,
        fontSize: 12,
        color: colors.textBody,
        opacity: 0.7
    }
});
