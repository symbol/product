import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { knownAccounts } from '@/app/config';
import { getColorFromHash } from '@/app/utils';

const KNOWN_ACCOUNT_IMAGES = {
    Binance: require('@/app/assets/images/account-logos/binance.png'),
    Bitbns: require('@/app/assets/images/account-logos/bitbns.png'),
    Bitflyer: require('@/app/assets/images/account-logos/bitflyer.png'),
    Bithumb: require('@/app/assets/images/account-logos/bithumb.png'),
    Bittrex: require('@/app/assets/images/account-logos/bittrex.png'),
    Coincheck: require('@/app/assets/images/account-logos/coincheck.png'),
    Copper: require('@/app/assets/images/account-logos/copper.png'),
    Crex24: require('@/app/assets/images/account-logos/crex24.png'),
    'Gate.io': require('@/app/assets/images/account-logos/gateio.png'),
    GraviEX: require('@/app/assets/images/account-logos/graviex.png'),
    HitBTC: require('@/app/assets/images/account-logos/hitbtc.png'),
    Huobi: require('@/app/assets/images/account-logos/huobi.png'),
    Kuna: require('@/app/assets/images/account-logos/kuna.png'),
    'NEM Group Limited': require('@/app/assets/images/account-logos/ngl.png'),
    'NEM Group Trust': require('@/app/assets/images/account-logos/ngl.png'),
    'NEM Holdings Limited': require('@/app/assets/images/account-logos/ngl.png'),
    'NEM Ventures Limited': require('@/app/assets/images/account-logos/nvl.png'),
    Okex: require('@/app/assets/images/account-logos/okex.png'),
    Poloniex: require('@/app/assets/images/account-logos/poloniex.png'),
    Spectrocoin: require('@/app/assets/images/account-logos/spectrocoin.png'),
    Upbit: require('@/app/assets/images/account-logos/upbit.png'),
    XTcom: require('@/app/assets/images/account-logos/xtcom.png'),
    Yobit: require('@/app/assets/images/account-logos/yobit.png'),
    Zaif: require('@/app/assets/images/account-logos/zaif.png'),
    Kucoin: require('@/app/assets/images/account-logos/kucoin.png'),
    AEX: require('@/app/assets/images/account-logos/aex.png'),
    Bitrue: require('@/app/assets/images/account-logos/bitrue.png'),
    Xtheta: require('@/app/assets/images/account-logos/xtheta.png'),
    Probit: require('@/app/assets/images/account-logos/probit.png'),
    'ZB.com': require('@/app/assets/images/account-logos/zbcom.png'),
    Latoken: require('@/app/assets/images/account-logos/latoken.png'),
    CoinEx: require('@/app/assets/images/account-logos/coinex.png'),
    Bitbank: require('@/app/assets/images/account-logos/bitbank.png'),
    Bybit: require('@/app/assets/images/account-logos/bybit.png'),
    MEXC: require('@/app/assets/images/account-logos/mexc.png'),
    'Symbol Protocol Treasury': require('@/app/assets/images/account-logos/symbol.png'),
    'Quadratic Funding': require('@/app/assets/images/account-logos/symbol.png'),
    'Harvest Network Fee Sink': require('@/app/assets/images/account-logos/symbol.png'),
    'Namespace and Mosaic Fee Sink': require('@/app/assets/images/account-logos/symbol.png'),
};

export const AccountAvatar = (props) => {
    const { address, size, style } = props;
    const rootStyle = [styles.root, style];
    const imageStyle = [styles.image];
    const unknownImageSrc = require('@/app/assets/images/icon-question.png');

    switch (size) {
        default:
        case 'sm':
            rootStyle.push(styles.rootSm);
            break;
        case 'md':
            rootStyle.push(styles.rootMd);
            break;
        case 'lg':
            rootStyle.push(styles.rootLg);
            break;
    }

    const getAddressImageSrc = () => {
        let imageSrc;
        const addressSecondChar = address[1].toUpperCase();
        switch (addressSecondChar) {
            default:
            case 'A':
                imageSrc = require('@/app/assets/images/avatars/avatar-1.png');
                break;
            case 'B':
                imageSrc = require('@/app/assets/images/avatars/avatar-2.png');
                break;
            case 'C':
                imageSrc = require('@/app/assets/images/avatars/avatar-3.png');
                break;
            case 'D':
                imageSrc = require('@/app/assets/images/avatars/avatar-4.png');
                break;
        }

        imageStyle.push({
            backgroundColor: getColorFromHash(address),
        });

        if (knownAccounts.hasOwnProperty(address) && KNOWN_ACCOUNT_IMAGES[knownAccounts[address]]) {
            imageSrc = KNOWN_ACCOUNT_IMAGES[knownAccounts[address]];
        }

        return imageSrc;
    };

    const imageSrc = address ? getAddressImageSrc() : unknownImageSrc;

    return (
        <View style={rootStyle}>
            <Image source={imageSrc} style={imageStyle} />
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        overflow: 'hidden',
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
    },
});
