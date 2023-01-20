import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { knownAccounts } from 'src/config';
import { getColorFromHash,} from 'src/utils';

const KNOWN_ACCOUNT_IMAGES = {
    'Binance': require('src/assets/images/account-logos/binance.png'),
    'Bitbns': require('src/assets/images/account-logos/bitbns.png'),
    'Bitflyer': require('src/assets/images/account-logos/bitflyer.png'),
    'Bithumb': require('src/assets/images/account-logos/bithumb.png'),
    'Bittrex': require('src/assets/images/account-logos/bittrex.png'),
    'Coincheck': require('src/assets/images/account-logos/coincheck.png'),
    'Copper': require('src/assets/images/account-logos/copper.png'),
    'Crex24': require('src/assets/images/account-logos/crex24.png'),
    'Gate.io': require('src/assets/images/account-logos/gateio.png'),
    'GraviEX': require('src/assets/images/account-logos/graviex.png'),
    'HitBTC': require('src/assets/images/account-logos/hitbtc.png'),
    'Huobi': require('src/assets/images/account-logos/huobi.png'),
    'Kuna': require('src/assets/images/account-logos/kuna.png'),
    'NEM Group Limited': require('src/assets/images/account-logos/ngl.png'),
    'NEM Group Trust': require('src/assets/images/account-logos/ngl.png'),
    'NEM Holdings Limited': require('src/assets/images/account-logos/ngl.png'),
    'NEM Ventures Limited': require('src/assets/images/account-logos/nvl.png'),
    'Okex': require('src/assets/images/account-logos/okex.png'),
    'Poloniex': require('src/assets/images/account-logos/poloniex.png'),
    'Spectrocoin': require('src/assets/images/account-logos/spectrocoin.png'),
    'Upbit': require('src/assets/images/account-logos/upbit.png'),
    'XTcom': require('src/assets/images/account-logos/xtcom.png'),
    'Yobit': require('src/assets/images/account-logos/yobit.png'),
    'Zaif': require('src/assets/images/account-logos/zaif.png'),
    'Kucoin': require('src/assets/images/account-logos/kucoin.png'),
    'AEX': require('src/assets/images/account-logos/aex.png'),
    'Bitrue': require('src/assets/images/account-logos/bitrue.png'),
    'Xtheta': require('src/assets/images/account-logos/xtheta.png'),
    'Probit': require('src/assets/images/account-logos/probit.png'),
    'ZB.com': require('src/assets/images/account-logos/zbcom.png'),
    'Latoken': require('src/assets/images/account-logos/latoken.png'),
    'CoinEx': require('src/assets/images/account-logos/coinex.png'),
    'Bitbank': require('src/assets/images/account-logos/bitbank.png'),
    'Bybit': require('src/assets/images/account-logos/bybit.png'),
    'MEXC': require('src/assets/images/account-logos/mexc.png'),
    'Symbol Protocol Treasury': require('src/assets/images/account-logos/symbol.png'),
    'Quadratic Funding': require('src/assets/images/account-logos/symbol.png'),
    'Harvest Network Fee Sink': require('src/assets/images/account-logos/symbol.png'),
    'Namespace and Mosaic Fee Sink': require('src/assets/images/account-logos/symbol.png'),
};

export const AccountAvatar = (props) => {
    const { address, size, style } = props;
    const addressSecondChar = address[1].toUpperCase();
    const rootStyle = [styles.root, style];
    const imageStyle = [styles.image];
    let imageSrc;
    
    switch(size) {
        default:
        case 'sm': rootStyle.push(styles.rootSm); break;
        case 'md': rootStyle.push(styles.rootMd); break;
        case 'lg': rootStyle.push(styles.rootLg); break;
    }

    switch(addressSecondChar) {
        default:
        case 'A': imageSrc = require('src/assets/images/avatars/avatar-1.png'); break;
        case 'B': imageSrc = require('src/assets/images/avatars/avatar-2.png'); break;
        case 'C': imageSrc = require('src/assets/images/avatars/avatar-3.png'); break;
        case 'D': imageSrc = require('src/assets/images/avatars/avatar-4.png'); break;
    }

    imageStyle.push({
        backgroundColor: getColorFromHash(address)
    });
    
    if (knownAccounts.hasOwnProperty(address) && KNOWN_ACCOUNT_IMAGES[knownAccounts[address]]) {
        imageSrc = KNOWN_ACCOUNT_IMAGES[knownAccounts[address]];
    }

    return (
        <View style={rootStyle}>
            <Image source={imageSrc} style={imageStyle} />
        </View>
    )
}

const styles = StyleSheet.create({
    root: {
        overflow: 'hidden'
    },
    rootSm: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    rootMd: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    rootLg: {
        width: 128,
        height: 128,
        borderRadius: 64,
    },
    image: {
        width: '100%',
        height: '100%',
    }
});
