import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { connect } from 'src/store';
import { spacings } from 'src/styles';
import { AccountAvatar, ButtonCopy, FormItem, StyledText } from 'src/components';
import { $t } from 'src/localization';
import { getAddressName, isSymbolAddress } from 'src/utils';

const renderTypeMap = {
    address: [
        'address',
        'recipientAddress',
        'sender',
        'recipient',
        'signerAddress',
        'linkedAccountAddress',
        'targetAddress',
        'sourceAddress',
        'creator',
        'linkedAddress',
        '_cosignatories',
        '_restrictionAddressAdditions',
        '_restrictionAddressDeletions',
        '_addressAdditions',
        '_receivedCosignatures',
        '_addressDeletions',
        '_multisigAddresses',
    ],
    copyButton: [
        'id',
        'metadataValue',
        'privateKey',
        'publicKey',
        'vrfPublicKey',
        'remotePublicKey',
        'linkedPublicKey',
        'nodePublicKey',
        'secret',
        'proof',
        'hash',
        'name',
    ],
    boolean: [
        'supplyMutable',
        'transferable',
        'restrictable',
        'revokable',
        'isSupplyMutable',
        'isTransferable',
        'isRestrictable',
        'isRevokable',
    ],
    fee: ['fee', 'maxFee', 'rentalFee', 'transactionFee'],
    message: ['message'],
    mosaics: ['mosaics'],
    mosaic: ['mosaic'],
    encryption: ['messageEncrypted'],
    transactionType: ['type', 'transactionType', '_restrictionOperationAdditions', '_restrictionOperationDeletions'],
    translate: [
        'registrationType',
        'aliasAction',
        'action',
        'restrictionType',
        'previousRestrictionType',
        'newRestrictionType',
        'linkAction',
    ],
};

const getMosaicIconSrc = (mosaic) =>
    mosaic.name === 'symbol.xym'
        ? require('src/assets/images/icon-select-mosaic-native.png')
        : require('src/assets/images/icon-select-mosaic-custom.png');
const getMosaicStyle = (index) => (index === 0 ? [styles.mosaic, { marginTop: 0 }] : styles.mosaic);

export const TableView = connect((state) => ({
    currentAccount: state.account.current,
    walletAccounts: state.wallet.accounts,
    networkIdentifier: state.network.networkIdentifier,
    addressBook: state.addressBook.addressBook,
    ticker: state.network.ticker,
}))(function TableView(props) {
    const { currentAccount, walletAccounts, networkIdentifier, addressBook, data, ticker, style, showEmptyArrays, rawAddresses } = props;
    const accounts = walletAccounts[networkIdentifier];

    if (!data || typeof data !== 'object') {
        return null;
    }

    let tableData = data;

    if (!Array.isArray(data)) {
        tableData = Object.entries(data)
            // eslint-disable-next-line no-unused-vars
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => ({ key, value }));
    }

    const renderKey = (item) => {
        const translatedKey = $t(`data_${item.key}`);

        return (
            <StyledText type="label" style={styles.key}>
                {translatedKey}
            </StyledText>
        );
    };

    const renderValue = (item) => {
        let ItemTemplate;

        Object.keys(renderTypeMap).forEach((renderType) =>
            renderTypeMap[renderType].find((acceptedKey) => {
                if (item.key !== acceptedKey) {
                    return false;
                }

                switch (renderType) {
                    case 'boolean':
                        ItemTemplate = (
                            <View style={styles.bool}>
                                {item.value === true && (
                                    <Image source={require('src/assets/images/icon-bool-true.png')} style={styles.boolIcon} />
                                )}
                                {item.value === false && (
                                    <Image source={require('src/assets/images/icon-bool-false.png')} style={styles.boolIcon} />
                                )}
                            </View>
                        );
                        break;
                    case 'transactionType':
                        ItemTemplate = <StyledText type="body">{$t(`transactionDescriptor_${item.value}`)}</StyledText>;
                        break;
                    case 'address':
                        ItemTemplate =
                            !rawAddresses && isSymbolAddress(item.value) ? (
                                <View style={styles.account}>
                                    <AccountAvatar address={item.value} style={styles.avatar} size="sm" />
                                    <StyledText type="body" style={styles.copyText}>
                                        {getAddressName(item.value, currentAccount, accounts, addressBook)}
                                    </StyledText>
                                    <ButtonCopy content={item.value} style={styles.button} />
                                </View>
                            ) : !rawAddresses ? (
                                <View style={styles.account}>
                                    <Image source={require('src/assets/images/icon-account-name.png')} style={styles.mosaicIcon} />
                                    <StyledText type="body" style={styles.copyText}>
                                        {item.value}
                                    </StyledText>
                                    <ButtonCopy content={item.value} style={styles.button} />
                                </View>
                            ) : (
                                <View style={styles.account}>
                                    <StyledText type="body" style={styles.copyText}>
                                        {item.value}
                                    </StyledText>
                                    <ButtonCopy content={item.value} style={styles.button} />
                                </View>
                            );
                        break;
                    case 'copyButton':
                        ItemTemplate = (
                            <View style={styles.row}>
                                <StyledText type="body" style={styles.copyText}>
                                    {item.value}
                                </StyledText>
                                <ButtonCopy content={item.value} style={styles.button} />
                            </View>
                        );
                        break;
                    case 'encryption':
                        ItemTemplate = (
                            <View style={styles.row}>
                                <StyledText type="body">{item.value === true ? $t('data_encrypted') : $t('data_unencrypted')}</StyledText>
                            </View>
                        );
                        break;
                    case 'fee':
                        ItemTemplate = (
                            <View style={styles.fee}>
                                <Image source={require('src/assets/images/icon-select-mosaic-native.png')} style={styles.mosaicIcon} />
                                <StyledText type="body">
                                    {item.value} {ticker}
                                </StyledText>
                            </View>
                        );
                        break;
                    case 'message':
                        ItemTemplate = (
                            <View style={styles.message}>
                                {item.value.isEncrypted && (
                                    <Image source={require('src/assets/images/icon-tx-lock.png')} style={styles.messageLockIcon} />
                                )}
                                <StyledText type="body">{item.value.text}</StyledText>
                            </View>
                        );
                        break;
                    case 'mosaic':
                        ItemTemplate = (
                            <View style={styles.col}>
                                <View style={getMosaicStyle(0)}>
                                    <Image source={getMosaicIconSrc(item.value)} style={styles.mosaicIcon} />
                                    <View style={styles.mosaicBody}>
                                        <StyledText type="body">{item.value.name}</StyledText>
                                        <StyledText type="body" style={styles.mosaicAmount}>
                                            {item.value.amount === null ? '?' : item.value.amount}
                                        </StyledText>
                                    </View>
                                </View>
                            </View>
                        );
                        break;
                    case 'mosaics':
                        ItemTemplate = (
                            <View style={styles.col}>
                                {item.value.map((mosaic, index) => (
                                    <View style={getMosaicStyle(index)} key={'t_mos' + index}>
                                        <Image source={getMosaicIconSrc(mosaic)} style={styles.mosaicIcon} />
                                        <View style={styles.mosaicBody}>
                                            <StyledText type="body">{mosaic.name}</StyledText>
                                            <StyledText type="body" style={styles.mosaicAmount}>
                                                {mosaic.amount === null ? '?' : mosaic.amount}
                                            </StyledText>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        );
                        break;
                    case 'translate':
                        ItemTemplate = <StyledText type="body">{$t(`data_${item.value}`)}</StyledText>;
                        break;
                }

                return true;
            })
        );

        if (!ItemTemplate && Array.isArray(item.value) && item.value.length) {
            return item.value.map((value) => renderValue({ key: `_${item.key}`, value: value }));
        }

        if (!ItemTemplate && typeof item.value === 'object') {
            return null;
        }

        if (!ItemTemplate) {
            ItemTemplate = <StyledText type="body">{item.value}</StyledText>;
        }

        return ItemTemplate;
    };

    const isEmptyField = (item) => {
        if (Array.isArray(item.value)) {
            return !(item.value.length || showEmptyArrays);
        }

        return item.value === '' || item.value === null;
    };

    return (
        <View style={[styles.root, style]}>
            {tableData.map((item, index) =>
                isEmptyField(item) ? null : (
                    <FormItem key={'table' + item.key + index} clear="horizontal">
                        {renderKey(item)}
                        {renderValue(item)}
                    </FormItem>
                )
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    root: {
        width: '100%',
    },
    row: {
        width: '100%',
        flexDirection: 'row',
    },
    col: {
        width: '100%',
        flexDirection: 'column',
    },
    key: {
        opacity: 0.8,
    },
    copyText: {
        flex: 1,
        flexWrap: 'wrap',
    },
    button: {
        paddingLeft: spacings.paddingSm,
    },
    mosaic: {
        marginTop: spacings.margin / 2,
        flexDirection: 'row',
        alignItems: 'center',
    },
    mosaicBody: {
        flexDirection: 'column',
    },
    mosaicAmount: {
        opacity: 0.7,
    },
    mosaicIcon: {
        height: 24,
        width: 24,
        maxHeight: '100%',
        marginRight: spacings.paddingSm,
    },
    account: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        marginRight: spacings.paddingSm,
    },
    bool: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    boolIcon: {
        width: 12,
        height: 12,
    },
    fee: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    message: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    messageLockIcon: {
        width: 12,
        height: 12,
        maxHeight: '100%',
        marginRight: spacings.paddingSm,
    },
});
