import React from 'react';
import { Image, StyleSheet, } from 'react-native';

const KNOWN_TOKEN_ICONS = {
    'ethereum:wxym': require('@/app/assets/images/tokens/ethereum-wxym-3.png'),
    'ethereum:eth': require('@/app/assets/images/tokens/ethereum-eth.png'),
    'symbol:symbol.xym': require('@/app/assets/images/tokens/symbol-xym.png'),
};

export const TokenIcon = props => {
    const { tokenName, chainName, style } = props;
    const iconKey = chainName.toLowerCase() + ':' + tokenName.toLowerCase();
    const iconSrc = KNOWN_TOKEN_ICONS[iconKey] || require('@/app/assets/images/icon-mosaic-custom.png');

    return <Image source={iconSrc} style={[styles.icon, style]} />;
};

const styles = StyleSheet.create({
    icon: {
        height: 40,
        width: 40
    }
});
